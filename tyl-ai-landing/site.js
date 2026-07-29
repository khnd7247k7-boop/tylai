(function () {
  var bodyScrollLockY = 0;

  function lockBodyScroll() {
    bodyScrollLockY = window.scrollY || window.pageYOffset || 0;
    document.body.classList.add("modal-open");
    document.body.style.position = "fixed";
    document.body.style.top = "-" + bodyScrollLockY + "px";
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
  }

  function unlockBodyScroll() {
    document.body.classList.remove("modal-open");
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    document.body.style.width = "";
    window.scrollTo(0, bodyScrollLockY);
  }

  function openModal(id) {
    var el = document.getElementById(id);
    if (!el) return;
    if (el.classList.contains("apparel-drawer")) {
      openApparelDrawer(id);
      return;
    }
    el.classList.add("open");
    el.classList.add("is-open");
    lockBodyScroll();
    el.scrollTop = 0;
  }

  function closeModal(id) {
    var el = document.getElementById(id);
    if (!el) return;
    if (el.classList.contains("apparel-drawer")) {
      closeApparelDrawer(id);
      return;
    }
    el.classList.remove("open");
    el.classList.remove("is-open");
    if (!document.querySelector(".modal-overlay.open") && !document.querySelector(".modal-overlay.is-open") && !document.querySelector(".apparel-drawer.is-open")) {
      unlockBodyScroll();
    }
  }

  function openApparelDrawer(id) {
    var drawer = document.getElementById(id);
    if (!drawer) return;
    drawer.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");
    lockBodyScroll();
    var scrollEl = drawer.querySelector(".apparel-drawer-scroll");
    if (scrollEl) scrollEl.scrollTop = 0;
  }

  function closeApparelDrawer(id) {
    var drawer = document.getElementById(id);
    if (!drawer) return;
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    if (!document.querySelector(".modal-overlay.open") && !document.querySelector(".apparel-drawer.is-open")) {
      unlockBodyScroll();
    }
  }

  function wireModal(openBtnId, modalId, closeBtnId) {
    var openBtn = openBtnId ? document.getElementById(openBtnId) : null;
    var modal = document.getElementById(modalId);
    var closeBtn = closeBtnId ? document.getElementById(closeBtnId) : null;
    if (openBtn && modal) {
      openBtn.addEventListener("click", function (e) {
        e.preventDefault();
        openModal(modalId);
      });
    }
    if (closeBtn && modal) {
      closeBtn.addEventListener("click", function () {
        closeModal(modalId);
      });
    }
    if (modal) {
      modal.addEventListener("click", function (e) {
        if (e.target === modal) closeModal(modalId);
      });
    }
  }

  var path = location.pathname.split("/").pop() || "index.html";
  if (!path || path === "/") path = "index.html";

  function markActiveNav() {
    var hash = location.hash || "";
    var page = document.body.getAttribute("data-page");
    document.querySelectorAll("#navMenu a, nav a[href]").forEach(function (a) {
      var href = a.getAttribute("href") || "";
      a.classList.remove("active", "is-active");
      if (href === path || href === "./" + path) {
        a.classList.add("active");
        return;
      }
      if (page && href.indexOf(page) !== -1) {
        a.classList.add("active");
        return;
      }
      if (path === "index.html" && href.indexOf("index.html#") === 0) {
        var linkHash = href.substring(href.indexOf("#"));
        if (hash && linkHash === hash) a.classList.add("active");
      }
    });
  }
  markActiveNav();

  var menuBtn = document.getElementById("menuBtn");
  var menu = document.getElementById("navMenu");

  function closeNavMenu() {
    if (!menu) return;
    menu.classList.remove("open");
    menu.classList.remove("is-open");
    document.body.classList.remove("nav-menu-open");
    if (menuBtn) {
      menuBtn.setAttribute("aria-expanded", "false");
      menuBtn.setAttribute("aria-label", "Open menu");
    }
  }

  function openNavMenu() {
    if (!menu) return;
    menu.classList.add("open");
    menu.classList.add("is-open");
    document.body.classList.add("nav-menu-open");
    if (menuBtn) {
      menuBtn.setAttribute("aria-expanded", "true");
      menuBtn.setAttribute("aria-label", "Close menu");
    }
  }

  if (menuBtn && menu) {
    menuBtn.setAttribute("aria-expanded", "false");
    menuBtn.setAttribute("aria-controls", "navMenu");
    menuBtn.addEventListener("click", function () {
      if (menu.classList.contains("is-open")) closeNavMenu();
      else openNavMenu();
    });
    menu.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        closeNavMenu();
      });
    });
    document.addEventListener("click", function (e) {
      if (!menu.classList.contains("is-open")) return;
      if (menu.contains(e.target) || menuBtn.contains(e.target)) return;
      closeNavMenu();
    });
  }

  wireModal("apparelBtn", "apparelModal", "apparelClose");
  wireModal("apparelRequestBtn", "apparelRequestModal", "apparelRequestClose");
  wireModal("contactOpen", "contactModal", "contactClose");
  wireModal("contactOpenFooter", "contactModal", "contactClose");

  document.querySelectorAll("[data-drawer-close]").forEach(function (el) {
    el.addEventListener("click", function () {
      var id = el.getAttribute("data-drawer-close");
      if (id) closeModal(id);
    });
  });

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    var openDrawer = document.querySelector(".apparel-drawer.is-open");
    if (openDrawer) closeModal(openDrawer.id);
    closeNavMenu();
    var openModalEl = document.querySelector(".modal-overlay.open, .modal-overlay.is-open");
    if (openModalEl) closeModal(openModalEl.id);
  });

  var apparelRequestFromModalBtn = document.getElementById("apparelRequestFromModalBtn");
  if (apparelRequestFromModalBtn) {
    apparelRequestFromModalBtn.addEventListener("click", function (e) {
      e.preventDefault();
      closeModal("apparelModal");
      openModal("apparelRequestModal");
    });
  }

  document.querySelectorAll(".contact-open-inline").forEach(function (el) {
    el.addEventListener("click", function (e) {
      e.preventDefault();
      closeModal("apparelModal");
      openModal("contactModal");
    });
  });

  function openLegalDoc(docId) {
    var doc = document.getElementById(docId);
    if (!doc) return;
    document.querySelectorAll(".legal-full-doc").forEach(function (panel) {
      panel.classList.remove("is-open");
      panel.hidden = true;
    });
    doc.classList.add("is-open");
    doc.hidden = false;
    doc.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function closeLegalDoc(summaryId) {
    document.querySelectorAll(".legal-full-doc").forEach(function (panel) {
      panel.classList.remove("is-open");
      panel.hidden = true;
    });
    var summary = document.getElementById(summaryId);
    if (summary) summary.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  document.querySelectorAll(".legal-expand-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      openLegalDoc(btn.getAttribute("data-legal-target"));
    });
  });

  document.querySelectorAll(".legal-collapse-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      closeLegalDoc(btn.getAttribute("data-legal-summary"));
    });
  });

  if (location.hash === "#privacy-policy-full") {
    openLegalDoc("privacy-policy-full-doc");
  } else if (location.hash === "#terms-of-service-full") {
    openLegalDoc("terms-of-service-full-doc");
  } else if (location.hash === "#privacy-policy") {
    var el = document.getElementById("privacy-policy");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  } else if (location.hash === "#terms-of-service") {
    var el2 = document.getElementById("terms-of-service");
    if (el2) el2.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function waitlistApiUrl() {
    var cfg = window.TYL_SITE_CONFIG || {};
    return cfg.waitlistApiUrl || "/api/waitlist";
  }

  function handleFormSubmit(formId, successId, payloadBuilder) {
    var form = document.getElementById(formId);
    var success = document.getElementById(successId);
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      var payload = payloadBuilder(form);
      console.info("[TYL AI form]", formId, payload);
      form.querySelector('button[type="submit"]').disabled = true;
      if (success) success.classList.add("visible");
    });
  }

  (function wireWaitlistForm() {
    var form = document.getElementById("waitlistForm");
    var success = document.getElementById("waitlistSuccess");
    var errorEl = document.getElementById("waitlistError");
    if (!form) return;

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      var submitBtn = form.querySelector('button[type="submit"]');
      var payload = {
        name: form.name.value.trim(),
        email: form.email.value.trim(),
        source: "landing-page",
      };

      if (errorEl) {
        errorEl.hidden = true;
        errorEl.textContent = "";
      }
      if (success) success.classList.remove("visible");
      submitBtn.disabled = true;

      fetch(waitlistApiUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then(function (res) {
          return res.json().then(function (data) {
            return { ok: res.ok, data: data };
          });
        })
        .then(function (result) {
          if (!result.ok) {
            throw new Error((result.data && result.data.error) || "Something went wrong");
          }
          if (success) {
            success.textContent = result.data.emailSent
              ? "You're on the list — check your inbox for a personal note from us."
              : "You're on the list — we'll be in touch soon.";
            success.classList.add("visible");
          }
        })
        .catch(function (err) {
          submitBtn.disabled = false;
          if (errorEl) {
            errorEl.textContent =
              err.message || "Could not submit right now. Please try again or email travis@tyl-ai.com.";
            errorEl.hidden = false;
          }
        });
    });
  })();

  (function wireApparelRequestForm() {
    var form = document.getElementById("apparelRequestForm");
    var success = document.getElementById("apparelRequestSuccess");
    var errorEl = document.getElementById("apparelRequestError");
    var fileInput = document.getElementById("apparelDesignFile");
    var fileHint = document.getElementById("apparelDesignFileHint");
    if (!form) return;

    var MAX_IMAGE_BYTES = 5 * 1024 * 1024;

    if (fileInput && fileHint) {
      fileInput.addEventListener("change", function () {
        var file = fileInput.files && fileInput.files[0];
        if (!file) {
          fileHint.textContent = "JPG, PNG, WebP, or GIF · max 5 MB";
          return;
        }
        if (file.size > MAX_IMAGE_BYTES) {
          fileHint.textContent = "File is too large — please use an image under 5 MB.";
          fileInput.value = "";
          return;
        }
        fileHint.textContent = "Selected: " + file.name;
      });
    }

    function readFileAsBase64(file) {
      return new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onload = function () {
          var result = typeof reader.result === "string" ? reader.result : "";
          var base64 = result.indexOf(",") >= 0 ? result.split(",")[1] : result;
          resolve(base64);
        };
        reader.onerror = function () {
          reject(new Error("Could not read the image file"));
        };
        reader.readAsDataURL(file);
      });
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      var description = form.designDescription.value.trim();
      var file = fileInput && fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;

      if (!description && !file) {
        if (errorEl) {
          errorEl.textContent = "Upload a reference image or describe your design.";
          errorEl.hidden = false;
        }
        return;
      }

      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      if (file && file.size > MAX_IMAGE_BYTES) {
        if (errorEl) {
          errorEl.textContent = "Reference image must be 5 MB or smaller.";
          errorEl.hidden = false;
        }
        return;
      }

      var submitBtn = form.querySelector('button[type="submit"]');
      if (errorEl) {
        errorEl.hidden = true;
        errorEl.textContent = "";
      }
      if (success) success.classList.remove("visible");
      submitBtn.disabled = true;
      submitBtn.textContent = "Sending…";

      var payload = {
        name: form.name.value.trim(),
        email: form.email.value.trim(),
        phone: form.phone.value.trim(),
        garmentType: form.garmentType.value,
        size: form.size.value,
        color: form.color.value.trim(),
        quantity: Number(form.quantity.value) || 1,
        placement: form.placement.value,
        designDescription: description,
        additionalNotes: form.additionalNotes.value.trim(),
        source: "apparel-page",
      };

      var submitRequest = file
        ? readFileAsBase64(file).then(function (base64) {
            payload.designImage = {
              filename: file.name,
              contentType: file.type,
              base64: base64,
            };
          })
        : Promise.resolve();

      submitRequest
        .then(function () {
          return fetch("/api/apparel-request", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }).then(function (res) {
            return res.json().then(function (data) {
              return { ok: res.ok, data: data };
            });
          });
        })
        .then(function (result) {
          if (!result.ok) {
            throw new Error((result.data && result.data.error) || "Something went wrong");
          }
          if (success) {
            success.textContent = result.data.confirmationSent
              ? "Request sent! Check your inbox for a confirmation — we’ll follow up with pricing and next steps."
              : "Request sent! We received your details and will follow up by email soon.";
            success.classList.add("visible");
          }
          form.reset();
          submitBtn.disabled = false;
          submitBtn.textContent = "Submit custom request";
          if (fileHint) fileHint.textContent = "JPG, PNG, WebP, or GIF · max 5 MB";
        })
        .catch(function (err) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Submit custom request";
          if (errorEl) {
            errorEl.textContent =
              err.message || "Could not submit right now. Please try again or email travis@tyl-ai.com.";
            errorEl.hidden = false;
          }
        });
    });
  })();

  (function wireJoinPricing() {
    var yearly = document.getElementById("stripeYearlyLink");
    var monthly = document.getElementById("stripeMonthlyLink");
    if (!yearly && !monthly) return;

    function setPrice(el, price, period) {
      if (!el) return;
      el.innerHTML = price + "<span>" + period + "</span>";
    }

    function setFeatures(el, items) {
      if (!el || !items || !items.length) return;
      el.innerHTML = items
        .map(function (item) {
          return "<li>" + item + "</li>";
        })
        .join("");
    }

    function applyPlan(prefix, plan) {
      if (!plan) return;
      var planName = document.getElementById(prefix + "PlanName");
      var tagline = document.getElementById(prefix + "Tagline");
      var link = document.getElementById(
        prefix === "yearly" ? "stripeYearlyLink" : "stripeMonthlyLink"
      );
      setPrice(document.getElementById(prefix + "Price"), plan.price, plan.period);
      if (planName) planName.textContent = plan.planName;
      if (tagline) {
        tagline.textContent = plan.tagline;
        tagline.classList.toggle("pricing-tagline-save", plan.taglineHighlight === true);
      }
      setFeatures(document.getElementById(prefix + "Features"), plan.features);
      if (link && plan.stripeUrl) {
        link.href = plan.stripeUrl;
        link.textContent = plan.button;
      }
    }

    fetch("/api/config")
      .then(function (res) {
        return res.ok ? res.json() : null;
      })
      .then(function (data) {
        if (!data) return;

        var eyebrow = document.getElementById("pricingEyebrow");
        var scarcity = document.getElementById("pricingScarcity");
        if (eyebrow && data.eyebrow) eyebrow.textContent = data.eyebrow;
        if (scarcity) {
          if (data.showScarcity && data.scarcityText) {
            scarcity.textContent = data.scarcityText;
            scarcity.hidden = false;
          } else {
            scarcity.hidden = true;
          }
        }

        applyPlan("yearly", data.yearly);
        applyPlan("monthly", data.monthly);

        if (data.mode === "standard") {
          document.title = "Subscribe — TYLAI";
          var meta = document.querySelector('meta[name="description"]');
          if (meta) {
            meta.setAttribute(
              "content",
              "Subscribe to TYLAI Premium — AI coaching, personalized workouts, and full app access on TestFlight."
            );
          }
        }
      })
      .catch(function () {});
  })();

  handleFormSubmit("contactForm", "contactSuccess", function (form) {
    return {
      type: "contact",
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      message: form.message.value.trim(),
      source: "landing-page"
    };
  });

  /* Apparel shop: gallery + Stripe Payment Link checkout (ship-to-customer) */
  (function wireApparelShop() {
    var buyBtn = document.getElementById("apparelBuyBtn");
    if (!buyBtn) return;

    /**
     * Paste your Stripe Payment Link URL here (or set window.TYL_APPAREL_STRIPE_LINK before site.js).
     *
     * Required Stripe Payment Link settings (Dashboard → Payment links → your link):
     * 1. Collect shipping addresses = ON  (this is how we ship to the buyer, not you)
     * 2. Collect phone numbers = ON (recommended for carriers)
     * 3. Custom fields → add "Size" (text or dropdown S–XXL) — backup if reference id is missed
     * 4. After payment → Don’t show confirmation page → Redirect to:
     *    https://YOUR-DOMAIN/apparel-thanks.html
     * 5. Adjustable quantity = ON (optional; we also pass prefilled_quantity)
     *
     * After each sale: open Stripe → Payments → open the charge → copy Shipping details
     * into Printful/Printify as the recipient address. See apparel-fulfillment.html.
     */
    var APPAREL_STRIPE_PAYMENT_LINK =
      window.TYL_APPAREL_STRIPE_LINK ||
      "https://buy.stripe.com/28E00i2Wq6CCatj4V64wM04";

    var PRODUCT = {
      skuPrefix: "TYL-TEE",
      name: "TYL Focus Tee",
      unitPrice: 34.99,
      printProviderHint: "Printful / Printify — ship to customer address from Stripe",
    };

    var ORDER_STORAGE_KEY = "tyl_apparel_pending_order_v1";
    var state = { size: "M", color: "Light Apricot", logo: "White", qty: 1 };

    var mainImage = document.getElementById("apparelMainImage");
    var colorLabel = document.getElementById("apparelColorLabel");
    var logoLabel = document.getElementById("apparelLogoLabel");
    var qtyInput = document.getElementById("apparelQty");
    var buyError = document.getElementById("apparelBuyError");
    var priceEl = document.getElementById("apparelPrice");
    var nameInput = document.getElementById("apparelBuyerName");
    var emailInput = document.getElementById("apparelBuyerEmail");
    var skuEl = document.getElementById("apparelOrderSku");
    var ticketList = document.getElementById("apparelOrderTicketList");

    function formatMoney(n) {
      return "$" + n.toFixed(2);
    }

    function slug(v) {
      return String(v || "")
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
    }

    function buildSku() {
      return (
        [PRODUCT.skuPrefix, slug(state.color), "LOGO-" + slug(state.logo), slug(state.size)].join("-") +
        " × " +
        state.qty
      );
    }

    function buildClientReferenceId(email) {
      // Stripe client_reference_id max length is 200. Encodes everything Travis needs at a glance.
      var parts = [
        PRODUCT.skuPrefix,
        slug(state.color),
        "L" + slug(state.logo),
        slug(state.size),
        "Q" + state.qty,
      ];
      var emailSlug = String(email || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9@._+-]/g, "")
        .slice(0, 48);
      if (emailSlug) parts.push(emailSlug);
      return parts.join("|").slice(0, 200);
    }

    function syncTicket() {
      if (skuEl) skuEl.textContent = buildSku();
      if (!ticketList) return;
      var name = nameInput && nameInput.value.trim() ? nameInput.value.trim() : "(collected at Stripe)";
      var email = emailInput && emailInput.value.trim() ? emailInput.value.trim() : "(collected at Stripe)";
      ticketList.innerHTML =
        "<li>Product: " +
        PRODUCT.name +
        "</li>" +
        "<li>SKU: " +
        buildSku() +
        "</li>" +
        "<li>Shirt color: " +
        state.color +
        "</li>" +
        "<li>Logo / design: " +
        state.logo +
        "</li>" +
        "<li>Size: " +
        state.size +
        "</li>" +
        "<li>Qty: " +
        state.qty +
        "</li>" +
        "<li>Buyer name: " +
        name +
        "</li>" +
        "<li>Buyer email: " +
        email +
        "</li>" +
        "<li>Ship to: (collected on Stripe)</li>" +
        "<li>Fulfillment: (collected on Stripe)</li>";
    }

    function syncBuyLabel() {
      var total = PRODUCT.unitPrice * state.qty;
      buyBtn.textContent = "Buy now — " + formatMoney(total);
      if (priceEl) priceEl.textContent = formatMoney(PRODUCT.unitPrice);
      syncTicket();
    }

    document.querySelectorAll(".apparel-thumb").forEach(function (thumb) {
      thumb.addEventListener("click", function () {
        document.querySelectorAll(".apparel-thumb").forEach(function (t) {
          t.classList.remove("is-active");
          t.setAttribute("aria-pressed", "false");
        });
        thumb.classList.add("is-active");
        thumb.setAttribute("aria-pressed", "true");
        if (mainImage) {
          mainImage.src = thumb.getAttribute("data-src");
          mainImage.alt = thumb.getAttribute("data-alt") || mainImage.alt;
        }
      });
    });

    document.querySelectorAll(".apparel-swatch:not(:disabled)").forEach(function (swatch) {
      swatch.addEventListener("click", function () {
        document.querySelectorAll(".apparel-swatch").forEach(function (s) {
          s.classList.remove("is-active");
          s.setAttribute("aria-pressed", "false");
        });
        swatch.classList.add("is-active");
        swatch.setAttribute("aria-pressed", "true");
        state.color = swatch.getAttribute("data-color") || "Light Apricot";
        if (colorLabel) colorLabel.textContent = state.color;
        syncTicket();
      });
    });

    document.querySelectorAll(".apparel-logo-choice").forEach(function (btn) {
      btn.addEventListener("click", function () {
        document.querySelectorAll(".apparel-logo-choice").forEach(function (b) {
          b.classList.remove("is-active");
          b.setAttribute("aria-pressed", "false");
        });
        btn.classList.add("is-active");
        btn.setAttribute("aria-pressed", "true");
        state.logo = btn.getAttribute("data-logo") || "White";
        if (logoLabel) logoLabel.textContent = state.logo;
        syncTicket();
      });
    });

    document.querySelectorAll(".apparel-size").forEach(function (btn) {
      btn.addEventListener("click", function () {
        document.querySelectorAll(".apparel-size").forEach(function (b) {
          b.classList.remove("is-active");
          b.setAttribute("aria-pressed", "false");
        });
        btn.classList.add("is-active");
        btn.setAttribute("aria-pressed", "true");
        state.size = btn.getAttribute("data-size") || "M";
        syncTicket();
      });
    });

    function clampQty(n) {
      n = parseInt(n, 10);
      if (isNaN(n) || n < 1) n = 1;
      if (n > 10) n = 10;
      return n;
    }

    function setQty(n) {
      state.qty = clampQty(n);
      if (qtyInput) qtyInput.value = String(state.qty);
      syncBuyLabel();
    }

    var minus = document.getElementById("apparelQtyMinus");
    var plus = document.getElementById("apparelQtyPlus");
    if (minus) minus.addEventListener("click", function () { setQty(state.qty - 1); });
    if (plus) plus.addEventListener("click", function () { setQty(state.qty + 1); });
    if (qtyInput) {
      qtyInput.addEventListener("change", function () {
        setQty(qtyInput.value);
      });
    }
    if (nameInput) nameInput.addEventListener("input", syncTicket);
    if (emailInput) emailInput.addEventListener("input", syncTicket);

    function showBuyError(msg) {
      if (!buyError) return;
      buyError.hidden = false;
      buyError.textContent = msg;
    }

    buyBtn.addEventListener("click", function () {
      if (buyError) {
        buyError.hidden = true;
        buyError.textContent = "";
      }

      var buyerName = nameInput ? nameInput.value.trim() : "";
      var buyerEmail = emailInput ? emailInput.value.trim() : "";
      if (!buyerEmail || buyerEmail.indexOf("@") < 1) {
        showBuyError("Enter your email so we can confirm the order and reach you about shipping.");
        if (emailInput) emailInput.focus();
        return;
      }
      if (!buyerName) {
        showBuyError("Enter the full name that should appear on the shipping label.");
        if (nameInput) nameInput.focus();
        return;
      }

      if (!APPAREL_STRIPE_PAYMENT_LINK) {
        showBuyError(
          "Stripe Payment Link not configured yet. Create a Payment Link with shipping address collection enabled, then set TYL_APPAREL_STRIPE_LINK (see apparel-fulfillment.html)."
        );
        return;
      }

      var url;
      try {
        url = new URL(APPAREL_STRIPE_PAYMENT_LINK);
      } catch (e) {
        showBuyError("Invalid Stripe Payment Link URL.");
        return;
      }

      var refId = buildClientReferenceId(buyerEmail);
      url.searchParams.set("client_reference_id", refId);
      url.searchParams.set("prefilled_email", buyerEmail);
      url.searchParams.set("prefilled_quantity", String(state.qty));

      var pending = {
        createdAt: new Date().toISOString(),
        product: PRODUCT.name,
        sku: buildSku(),
        color: state.color,
        logo: state.logo,
        size: state.size,
        qty: state.qty,
        unitPrice: PRODUCT.unitPrice,
        total: Math.round(PRODUCT.unitPrice * state.qty * 100) / 100,
        buyerName: buyerName,
        buyerEmail: buyerEmail,
        clientReferenceId: refId,
        shipTo: "customer_address_on_stripe",
        fulfillment: PRODUCT.printProviderHint,
      };
      try {
        sessionStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(pending));
        localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(pending));
      } catch (e) {
        /* ignore quota / private mode */
      }

      window.location.href = url.toString();
    });

    syncBuyLabel();
  })();

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* Apparel thank-you page: show pending order ticket after Stripe redirect */
  (function wireApparelThanks() {
    var root = document.getElementById("apparelThanksDetails");
    if (!root) return;
    var ORDER_STORAGE_KEY = "tyl_apparel_pending_order_v1";
    var data = null;
    try {
      data =
        JSON.parse(sessionStorage.getItem(ORDER_STORAGE_KEY) || "null") ||
        JSON.parse(localStorage.getItem(ORDER_STORAGE_KEY) || "null");
    } catch (e) {
      data = null;
    }
    if (!data) {
      root.innerHTML =
        "<p>Thanks for your order. Your shipping address was collected by Stripe — we’ll fulfill from that address.</p>";
      return;
    }
    root.innerHTML =
      "<dl class=\"apparel-thanks-dl\">" +
      "<div><dt>Product</dt><dd>" +
      escapeHtml(data.product) +
      "</dd></div>" +
      "<div><dt>SKU</dt><dd>" +
      escapeHtml(data.sku) +
      "</dd></div>" +
      "<div><dt>Color / Size / Qty</dt><dd>" +
      escapeHtml(data.color) +
      " · " +
      escapeHtml(data.size) +
      " · " +
      escapeHtml(String(data.qty)) +
      "</dd></div>" +
      "<div><dt>Logo</dt><dd>" +
      escapeHtml(data.logo || "White") +
      "</dd></div>" +
      "<div><dt>Total</dt><dd>" +
      escapeHtml("$" + Number(data.total).toFixed(2)) +
      "</dd></div>" +
      "<div><dt>Name</dt><dd>" +
      escapeHtml(data.buyerName) +
      "</dd></div>" +
      "<div><dt>Email</dt><dd>" +
      escapeHtml(data.buyerEmail) +
      "</dd></div>" +
      "<div><dt>Shipping</dt><dd>Address you entered on Stripe checkout (ships to you)</dd></div>" +
      "<div><dt>Order ref</dt><dd><code>" +
      escapeHtml(data.clientReferenceId) +
      "</code></dd></div>" +
      "</dl>";
  })();
})();
