import { lookupFoodByBarcode, isScannedFoodUsable } from '../../utils/foodDatabase';
import { analyzeFoodPackageImage, type FoodPackageVisionResult } from '../geminiService';
import { fetchVerifiedMacros, type VerifiedMacroResult } from '../NutritionService';
import {
  FOOD_SCAN_CONFIDENCE,
  type FoodProduct,
  type FoodProductMatchCandidate,
  type SmartScanResult,
} from '../../types/foodProduct';
import {
  foodProductToScannedFood,
  hasUsableMacros,
  mergeFoodProducts,
  scannedFoodToFoodProduct,
} from './adapters';
import {
  enqueueOfflineScan,
  getFoodProductByBarcode,
  upsertFoodProduct,
} from './localFoodProductStore';

function newId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function visionToOcrProduct(vision: FoodPackageVisionResult, barcode?: string): FoodProduct | null {
  const calories = vision.calories ?? 0;
  const protein = vision.protein_g ?? 0;
  const carbs = vision.carbohydrates_g ?? 0;
  const fat = vision.totalFat_g ?? 0;
  const name =
    [vision.brand, vision.productName, vision.flavor].filter(Boolean).join(' ').trim() ||
    vision.productName ||
    'Scanned label';

  if (!vision.hasNutritionFacts && calories <= 0 && protein <= 0 && carbs <= 0 && fat <= 0) {
    return null;
  }

  return {
    id: newId('ocr'),
    barcode: barcode || vision.barcodeVisible || undefined,
    brand: vision.brand || undefined,
    productName: name,
    servingSize: vision.servingSize || undefined,
    servingsPerContainer: vision.servingsPerContainer ?? undefined,
    calories,
    protein,
    carbohydrates: carbs,
    fat,
    fiber: vision.fiber_g ?? undefined,
    sugar: vision.sugar_g ?? undefined,
    sodium: vision.sodium_mg ?? undefined,
    ingredients: vision.ingredients || undefined,
    micronutrients: {
      fiber: vision.fiber_g ?? undefined,
      sugar: vision.sugar_g ?? undefined,
      addedSugar: vision.addedSugar_g ?? undefined,
      sodium: vision.sodium_mg ?? undefined,
      cholesterol: vision.cholesterol_mg ?? undefined,
      saturatedFat: vision.saturatedFat_g ?? undefined,
      transFat: vision.transFat_g ?? undefined,
    },
    source: 'ocr',
    confidence: vision.ocrConfidence,
    nutritionNote: vision.notes || 'Extracted from Nutrition Facts label.',
  };
}

function visionToPackageProduct(vision: FoodPackageVisionResult, barcode?: string): FoodProduct | null {
  const productName = vision.productName?.trim();
  if (!productName && !vision.brand) return null;
  return {
    id: newId('pkg'),
    barcode: barcode || vision.barcodeVisible || undefined,
    brand: vision.brand || undefined,
    productName: [vision.brand, productName, vision.flavor].filter(Boolean).join(' ').trim(),
    calories: 0,
    protein: 0,
    carbohydrates: 0,
    fat: 0,
    ingredients: vision.ingredients || undefined,
    source: 'packageRecognition',
    confidence: vision.packageConfidence,
    nutritionNote: 'Identified from package front — confirm nutrition values.',
  };
}

function verifiedHitToProduct(hit: VerifiedMacroResult, confidence: number): FoodProduct {
  return {
    id: newId('db'),
    brand: hit.brand || undefined,
    productName: hit.name,
    servingSize: hit.servingDescription || undefined,
    calories: hit.calories ?? 0,
    protein: hit.protein ?? 0,
    carbohydrates: hit.carbs ?? 0,
    fat: hit.fat ?? 0,
    source: 'packageRecognition',
    confidence,
    nutritionNote: `Matched via ${hit.source}.`,
  };
}

function scoreSemanticMatch(query: string, hit: VerifiedMacroResult): number {
  const q = query.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const name = `${hit.brand ?? ''} ${hit.name}`.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const qTokens = q.split(/\s+/).filter((t) => t.length > 1);
  if (qTokens.length === 0) return 0.5;
  let hits = 0;
  for (const t of qTokens) {
    if (name.includes(t)) hits += 1;
  }
  const overlap = hits / qTokens.length;
  return Math.max(0.4, Math.min(0.96, 0.55 + overlap * 0.4));
}

/**
 * Step 1 — barcode detection lookup (local index → remote DBs).
 */
export async function identifyByBarcode(barcode: string): Promise<SmartScanResult> {
  const clean = String(barcode).replace(/\s/g, '').trim();
  if (!clean) {
    return { status: 'not_found', message: 'No barcode detected.' };
  }

  const local = await getFoodProductByBarcode(clean);
  if (local && hasUsableMacros(local)) {
    return {
      status: 'matched',
      product: { ...local, source: 'barcode', confidence: Math.max(local.confidence, 0.98) },
      autoPopulate: true,
    };
  }

  try {
    const scanned = await lookupFoodByBarcode(clean);
    if (scanned && isScannedFoodUsable(scanned)) {
      const product = scannedFoodToFoodProduct(scanned, {
        confidence: FOOD_SCAN_CONFIDENCE.barcode,
        source: 'barcode',
      });
      await upsertFoodProduct(product);
      return {
        status: 'matched',
        product,
        autoPopulate: product.confidence >= FOOD_SCAN_CONFIDENCE.barcode,
      };
    }
  } catch {
    // Fall through — caller may continue to OCR / package.
  }

  return {
    status: 'not_found',
    barcode: clean,
    message: `No nutrition data found for barcode ${clean}.`,
  };
}

/**
 * Steps 2–4 — OCR + package recognition + semantic DB search from a photo.
 */
export async function identifyFromPackageImage(input: {
  base64: string;
  mimeType?: string;
  barcodeHint?: string;
}): Promise<SmartScanResult> {
  let vision: FoodPackageVisionResult;
  try {
    vision = await analyzeFoodPackageImage({
      base64: input.base64,
      mimeType: input.mimeType,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/network|fetch|offline|unreachable/i.test(msg)) {
      await enqueueOfflineScan({
        barcode: input.barcodeHint,
        imageBase64: input.base64.slice(0, 200000),
        mimeType: input.mimeType || 'image/jpeg',
        note: 'Queued while offline',
      });
      return {
        status: 'not_found',
        barcode: input.barcodeHint,
        message: 'You appear offline. Scan saved locally and will sync when you are back online. Enter nutrition manually for now.',
      };
    }
    throw err;
  }

  const barcode = input.barcodeHint || vision.barcodeVisible || undefined;
  const ocrProduct = visionToOcrProduct(vision, barcode);
  const packageProduct = visionToPackageProduct(vision, barcode);

  // Prefer barcode DB match if vision exposed a code we haven't tried yet.
  if (barcode && !input.barcodeHint) {
    const byCode = await identifyByBarcode(barcode);
    if (byCode.status === 'matched') {
      if (ocrProduct && hasUsableMacros(ocrProduct)) {
        const merged = mergeFoodProducts(byCode.product, ocrProduct);
        await upsertFoodProduct(merged);
        return {
          status: merged.confidence >= FOOD_SCAN_CONFIDENCE.ocr ? 'matched' : 'needs_confirmation',
          product: merged,
          autoPopulate: merged.confidence >= FOOD_SCAN_CONFIDENCE.ocr,
        };
      }
      return byCode;
    }
  }

  const query =
    vision.searchQuery ||
    [vision.brand, vision.productName, vision.flavor].filter(Boolean).join(' ').trim();

  const candidates: FoodProductMatchCandidate[] = [];

  if (query) {
    try {
      const hits = await fetchVerifiedMacros(query);
      for (const hit of hits.slice(0, 6)) {
        const score = scoreSemanticMatch(query, hit);
        if (score < FOOD_SCAN_CONFIDENCE.candidateFloor) continue;
        candidates.push({
          product: verifiedHitToProduct(hit, score),
          reason: `Semantic match · ${Math.round(score * 100)}%`,
        });
      }
      candidates.sort((a, b) => b.product.confidence - a.product.confidence);
    } catch {
      // Semantic search optional when APIs fail.
    }
  }

  const top = candidates[0]?.product;
  let best: FoodProduct | null = null;

  if (top && ocrProduct && hasUsableMacros(ocrProduct)) {
    // DB identity + OCR macros when OCR is strong.
    best = mergeFoodProducts(
      { ...top, confidence: Math.max(top.confidence, FOOD_SCAN_CONFIDENCE.semanticSearch) },
      ocrProduct
    );
  } else if (ocrProduct && hasUsableMacros(ocrProduct) && ocrProduct.confidence >= FOOD_SCAN_CONFIDENCE.ocr) {
    best = ocrProduct;
  } else if (top && hasUsableMacros(top) && top.confidence >= FOOD_SCAN_CONFIDENCE.semanticSearch) {
    best = top;
  } else if (ocrProduct && hasUsableMacros(ocrProduct)) {
    best = ocrProduct;
  } else if (packageProduct) {
    best = packageProduct;
  }

  if (best && hasUsableMacros(best) && best.confidence >= FOOD_SCAN_CONFIDENCE.ocr) {
    await upsertFoodProduct(best);
    return { status: 'matched', product: best, autoPopulate: true };
  }

  if (candidates.length > 1) {
    return {
      status: 'candidates',
      candidates: candidates.slice(0, 5),
      partial: best ?? ocrProduct ?? packageProduct ?? undefined,
    };
  }

  if (best && hasUsableMacros(best)) {
    return { status: 'needs_confirmation', product: best };
  }

  if (best) {
    return { status: 'needs_confirmation', product: best };
  }

  return {
    status: 'not_found',
    barcode,
    message: 'Could not identify this product confidently. Enter nutrition from the label.',
  };
}

/**
 * Full pipeline: barcode first, then optional package image.
 */
export async function runSmartFoodScan(input: {
  barcode?: string;
  imageBase64?: string;
  mimeType?: string;
}): Promise<SmartScanResult> {
  if (input.barcode) {
    const barcodeResult = await identifyByBarcode(input.barcode);
    if (barcodeResult.status === 'matched' && barcodeResult.autoPopulate) {
      return barcodeResult;
    }
    if (input.imageBase64) {
      const visionResult = await identifyFromPackageImage({
        base64: input.imageBase64,
        mimeType: input.mimeType,
        barcodeHint: input.barcode,
      });
      if (
        barcodeResult.status === 'matched' &&
        (visionResult.status === 'matched' || visionResult.status === 'needs_confirmation')
      ) {
        const merged = mergeFoodProducts(barcodeResult.product, visionResult.product);
        await upsertFoodProduct(merged);
        return {
          status: merged.confidence >= FOOD_SCAN_CONFIDENCE.ocr ? 'matched' : 'needs_confirmation',
          product: merged,
          autoPopulate: merged.confidence >= FOOD_SCAN_CONFIDENCE.ocr,
        };
      }
      return visionResult;
    }
    if (barcodeResult.status === 'matched') return barcodeResult;
    return barcodeResult;
  }

  if (input.imageBase64) {
    return identifyFromPackageImage({
      base64: input.imageBase64,
      mimeType: input.mimeType,
    });
  }

  return { status: 'not_found', message: 'Point the camera at a barcode or food package.' };
}

export { foodProductToScannedFood, hasUsableMacros };
