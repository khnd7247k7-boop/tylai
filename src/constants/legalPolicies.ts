import {
  LEGAL_APP_NAME,
  LEGAL_APP_PRODUCT_NAME,
  LEGAL_COMPANY_NAME,
  LEGAL_CONTACT_EMAIL,
  LEGAL_EFFECTIVE_DATE,
  LEGAL_GOVERNING_COUNTRY,
  LEGAL_GOVERNING_STATE,
  LEGAL_LAST_UPDATED,
  LEGAL_WEBSITE,
} from './legalMeta';

const intro = (title: string) =>
  `${title}\n${'='.repeat(title.length)}\n\nEffective Date: ${LEGAL_EFFECTIVE_DATE}\nLast Updated: ${LEGAL_LAST_UPDATED}\n\n`;

export const PRIVACY_POLICY_CONTENT =
  intro('Privacy Policy') +
  `This Privacy Policy describes how ${LEGAL_COMPANY_NAME} ("${LEGAL_COMPANY_NAME}," "we," "us," or "our") collects, uses, discloses, and protects information when you use the ${LEGAL_APP_NAME} mobile application, related websites (including ${LEGAL_WEBSITE}), and associated products and services (collectively, the "Services"). ${LEGAL_APP_PRODUCT_NAME} is operated by ${LEGAL_COMPANY_NAME} from ${LEGAL_GOVERNING_STATE}, ${LEGAL_GOVERNING_COUNTRY}.

By using the Services, you agree to this Privacy Policy. If you do not agree, do not use the Services.

1. Who We Are
---------------
Data Controller: ${LEGAL_COMPANY_NAME}
Contact: ${LEGAL_CONTACT_EMAIL}
Website: ${LEGAL_WEBSITE}

2. Scope
--------
This Policy applies to personal information we process through the Services. It does not apply to third-party websites, apps, or services that you may access through links or integrations outside our control. Those providers are governed by their own privacy policies.

3. Information We Collect
-------------------------

3.1 Information You Provide
• Account and authentication data: name, email address, password (stored by our authentication provider in hashed form), and account identifiers.
• Profile and coaching data: age, height, weight, sex, fitness goals, experience level, training preferences, equipment availability, schedule, injuries or limitations you choose to disclose, and questionnaire responses.
• Workout data: exercise logs, sets, reps, weights, duration, rest periods, program selections, plan history, and completion status.
• Nutrition data: meals, calories, macronutrients, micronutrients, food names, portions, barcode scans, restaurant or menu selections, and nutrition goals.
• Wellness data: mood entries, journal notes, mindset check-ins, and related wellness logs you submit.
• Communications: support requests, feedback, and correspondence with us.
• Payment-related information: subscription status and billing identifiers processed by our payment partners. We do not store full payment card numbers on our servers.

3.2 Connected Health and Device Data
With your explicit permission through your device operating system, we may read (and in limited cases write) health and activity data, which may include:
• Apple Health / HealthKit data on iOS (e.g., heart rate, active energy, steps, distance, body weight, sleep, VO₂ max, and categories you authorize).
• Google Health Connect / Google Fit data on Android, where supported.
• Wearable or partner integrations you authorize in the future (e.g., Garmin, WHOOP, or similar partners), subject to separate consent and partner terms.

We use connected health data solely to personalize your in-app experience—for example, trends, charts, coaching context, recovery-oriented suggestions, and workout summaries. We do not sell Apple Health, HealthKit, or connected health data. We do not use health data for advertising or advertising profiling.

3.3 Automatically Collected Information
• Device and app information: device model, operating system version, app version, language, time zone, and unique device or installation identifiers.
• Log and diagnostic data: crash reports, performance data, error logs, and security events.
• Usage and analytics data: feature usage, session duration, interaction events, and aggregated product analytics to improve reliability and user experience.

3.4 Information from Third-Party Services
When you use features that rely on third parties, those providers may share information with us according to your settings and their policies, including:
• Firebase (Google) for authentication, cloud storage, and backend infrastructure.
• Stripe for subscription billing and payment processing.
• RevenueCat or platform billing systems for in-app purchase and subscription management, where enabled.
• Nutritionix, USDA FoodData Central, and other food databases for nutrition search and barcode lookup.
• Google Gemini, OpenAI, Anthropic, and other AI service providers for AI coaching, meal suggestions, and workout generation.
• Apple and Google platform services required for app distribution and device permissions.

4. How We Use Information
-------------------------
We use personal information to:
• Create and manage your account and authenticate you.
• Provide, maintain, and improve the Services, including workouts, nutrition logging, trends, and wellness features.
• Personalize coaching, recommendations, and in-app content based on your profile, logs, and permitted health data.
• Process subscriptions, renewals, refunds where applicable, and billing inquiries.
• Send service-related notices, security alerts, and—with your consent where required—product updates or reminders.
• Monitor, detect, and prevent fraud, abuse, and security incidents.
• Comply with law, enforce our Terms, and protect rights, safety, and property.
• Conduct aggregated or de-identified analytics that do not identify you.

We do not sell your personal information. We do not share personal information with third parties for their own independent marketing purposes.

5. Legal Bases (Where Applicable)
---------------------------------
Where required by law (e.g., EEA/UK GDPR), we process personal information based on: performance of a contract (providing the Services); legitimate interests (security, improvement, analytics in de-identified form); consent (health permissions, optional communications); and legal obligations.

6. How We Share Information
---------------------------
We may share information with:
• Service providers and subprocessors who assist us under contractual confidentiality and data-protection obligations, including hosting, authentication, payments, analytics, AI inference, nutrition databases, and customer support tools.
• Platform partners when you enable integrations (e.g., Apple Health, Google Health Connect, or future wearable partners).
• Professional advisors, auditors, or authorities when required by law, court order, or to protect legal rights.
• Successors in connection with a merger, acquisition, or asset sale, subject to this Policy or notice to you.

We require service providers to use information only to perform services for us and in accordance with applicable law and platform requirements (including Apple and Google health-data rules).

7. Data Storage and Security
----------------------------
We use industry-standard administrative, technical, and organizational measures designed to protect personal information, including encryption in transit (TLS), access controls, and secure cloud infrastructure provided by reputable vendors. No method of transmission or storage is completely secure; we cannot guarantee absolute security.

Data may be stored and processed in the United States and other countries where our service providers operate. By using the Services, you acknowledge such transfers may occur subject to appropriate safeguards where required.

8. Data Retention
-----------------
We retain personal information for as long as your account is active or as needed to provide the Services, comply with legal obligations, resolve disputes, and enforce agreements. When you delete data in the app or request deletion, we will delete or de-identify information within a reasonable period, except where retention is required by law or legitimate business needs (e.g., billing records, fraud prevention).

Locally stored data on your device can be removed using in-app data deletion tools where available.

9. Your Rights and Choices
--------------------------
Depending on your location, you may have the right to:
• Access personal information we hold about you.
• Correct inaccurate information through in-app profile settings or by contacting us.
• Delete your information or account, subject to legal exceptions.
• Export your data where export tools are provided in the app.
• Withdraw consent for optional processing (e.g., marketing or specific health categories via device settings).
• Object to or restrict certain processing where applicable law provides such rights.
• Lodge a complaint with a supervisory authority.

To exercise rights, email ${LEGAL_CONTACT_EMAIL}. We may verify your identity before responding. California residents: we do not sell personal information. You may have additional rights under the CCPA/CPRA, including knowing categories of data collected and requesting deletion.

10. Children's Privacy
----------------------
The Services are not directed to children under 13 (or the minimum age required in your jurisdiction). We do not knowingly collect personal information from children under 13. If you believe a child has provided us information, contact ${LEGAL_CONTACT_EMAIL} and we will take steps to delete it.

Users must meet eligibility requirements in our Terms of Service (typically 18+ or parental consent).

11. App Store and Google Play
-----------------------------
Our data practices are designed to align with Apple App Store Review Guidelines and Google Play Developer Program Policies, including requirements for privacy disclosures, permission requests, and health data use. Apple's HealthKit and Google Health Connect data are used only to provide health and fitness functionality in the app, not for advertising or use-based data mining, except for improving the app or for health management.

12. Third-Party Links and Partners
--------------------------------
Integrations with Apple, Google, Stripe, Nutritionix, wearable manufacturers, and other partners are subject to their terms and privacy policies. We encourage you to review those policies when you connect third-party services.

13. International Users
-------------------------
If you access the Services from outside the United States, you understand that your information may be transferred to and processed in the United States and other jurisdictions with different data-protection laws.

14. Changes to This Policy
--------------------------
We may update this Privacy Policy from time to time. We will post the updated version with a new "Last Updated" date and, where required, provide additional notice (e.g., in-app notice or email). Continued use after changes become effective constitutes acceptance of the updated Policy.

15. Contact Us
--------------
Questions about this Privacy Policy or our data practices:

${LEGAL_COMPANY_NAME}
Email: ${LEGAL_CONTACT_EMAIL}
Website: ${LEGAL_WEBSITE}`;

export const TERMS_OF_SERVICE_CONTENT =
  intro('Terms of Service') +
  `These Terms of Service ("Terms") govern your access to and use of the ${LEGAL_APP_NAME} mobile application, websites, and related services (collectively, the "Services") provided by ${LEGAL_COMPANY_NAME} ("${LEGAL_COMPANY_NAME}," "we," "us," or "our"), a ${LEGAL_GOVERNING_STATE} limited liability company.

By creating an account, downloading, or using the Services, you agree to these Terms and our Privacy Policy. If you do not agree, do not use the Services.

1. Eligibility
--------------
You must be at least 18 years old, or the age of majority in your jurisdiction, to use the Services. If you are under 18, you may use the Services only with involvement and consent of a parent or legal guardian who accepts these Terms on your behalf. You represent that all registration information is accurate and that you have authority to enter into these Terms.

2. Account Registration and Security
------------------------------------
You are responsible for maintaining the confidentiality of your credentials and for all activity under your account. Notify us immediately at ${LEGAL_CONTACT_EMAIL} of unauthorized use. We may suspend or terminate accounts that violate these Terms or pose security risks.

3. Description of Services
--------------------------
${LEGAL_APP_NAME} provides fitness tracking, workout planning, nutrition logging, wellness tools, trends, and optional AI-powered coaching features. Features may change, be added, or removed over time. Beta or preview features may be incomplete or unavailable without notice.

4. Subscriptions, Billing, and Renewals
---------------------------------------
Certain features require a paid subscription ("Premium" or similar). When you purchase a subscription:
• Payment is processed by Apple App Store, Google Play, Stripe, or other authorized payment processors.
• Subscriptions renew automatically unless canceled before the renewal date through your platform account settings (App Store / Google Play) or as described at purchase.
• Prices, tiers, and included features are displayed before purchase and may change with notice where required by law or platform policy.
• Taxes may apply based on your location.

Free trials or promotional offers, if any, convert to paid subscriptions unless canceled before the trial ends, as disclosed at sign-up.

5. Cancellations and Refunds
----------------------------
You may cancel a subscription through your Apple or Google account subscription settings, or through billing tools we provide for Stripe-managed plans. Cancellation stops future charges; access typically continues until the end of the current billing period.

Refunds are handled according to the policies of the platform where you purchased (Apple, Google, or Stripe) and applicable law. Except where required by law or platform policy, fees are non-refundable for partial billing periods. Contact ${LEGAL_CONTACT_EMAIL} for billing questions.

6. User Responsibilities
------------------------
You agree to:
• Use the Services only for lawful personal, non-commercial purposes unless we authorize otherwise.
• Provide accurate information and keep your profile reasonably up to date.
• Use workouts, nutrition guidance, and AI features responsibly and in accordance with disclaimers.
• Comply with all applicable laws and third-party platform terms (including Apple and Google).
• Not misuse, reverse engineer, scrape, overload, or interfere with the Services.
• Not upload unlawful, harmful, infringing, or harassing content.

7. Acceptable Use
-----------------
You may not:
• Violate intellectual property or privacy rights of others.
• Attempt unauthorized access to systems, accounts, or data.
• Use the Services to provide medical diagnosis, emergency services, or regulated clinical care.
• Circumvent subscription, access controls, or API limits.
• Use automated means to access the Services except as we expressly permit.

We may investigate violations and cooperate with law enforcement where appropriate.

8. Intellectual Property
------------------------
The Services, including software, design, trademarks, logos, text, graphics, and content we provide, are owned by ${LEGAL_COMPANY_NAME} or our licensors and protected by intellectual property laws. You receive a limited, non-exclusive, non-transferable, revocable license to use the Services for personal use in accordance with these Terms.

You retain ownership of content you submit (e.g., workout logs, journal entries). You grant us a license to host, process, and display your content solely to operate and improve the Services.

9. AI-Generated Content
-----------------------
AI features may produce workouts, nutrition suggestions, estimates, or coaching text. AI output is provided for informational purposes only. See our AI Disclaimer. You are responsible for evaluating AI recommendations before acting on them.

10. Health and Fitness Disclaimers
----------------------------------
The Services are not medical devices and do not provide medical advice. See our Fitness Disclaimer and AI Disclaimer, incorporated by reference. Physical activity involves risk; you assume responsibility for your health and safety.

11. Third-Party Services
------------------------
The Services integrate with third parties (e.g., Firebase, Stripe, Apple Health, Google Health Connect, Nutritionix, AI providers). Your use of those services is subject to their terms. We are not responsible for third-party products or services.

12. Account Suspension and Termination
--------------------------------------
We may suspend or terminate your access if you breach these Terms, create risk or legal exposure, or where required by law. You may stop using the Services at any time and may request account deletion via ${LEGAL_CONTACT_EMAIL} or in-app tools.

Upon termination, provisions that by nature should survive (including intellectual property, disclaimers, limitations of liability, and governing law) will survive.

13. Disclaimer of Warranties
------------------------------
TO THE FULLEST EXTENT PERMITTED BY LAW, THE SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICES WILL BE UNINTERRUPTED, ERROR-FREE, SECURE, OR THAT AI OUTPUT WILL BE ACCURATE OR COMPLETE.

Some jurisdictions do not allow exclusion of implied warranties; in those jurisdictions, our liability is limited to the maximum extent permitted.

14. Limitation of Liability
---------------------------
TO THE FULLEST EXTENT PERMITTED BY LAW, ${LEGAL_COMPANY_NAME} AND ITS OFFICERS, DIRECTORS, MEMBERS, EMPLOYEES, AGENTS, AND SUPPLIERS WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA, GOODWILL, OR OTHER INTANGIBLE LOSSES, ARISING FROM YOUR USE OF OR INABILITY TO USE THE SERVICES, EVEN IF ADVISED OF THE POSSIBILITY.

OUR TOTAL LIABILITY FOR ANY CLAIM ARISING OUT OF OR RELATING TO THE SERVICES OR THESE TERMS SHALL NOT EXCEED THE GREATER OF (A) THE AMOUNT YOU PAID US IN THE TWELVE (12) MONTHS BEFORE THE CLAIM OR (B) ONE HUNDRED U.S. DOLLARS (USD $100).

Some jurisdictions do not allow limitation of certain damages; in those cases, our liability is limited to the fullest extent permitted by law.

15. Indemnification
-------------------
You agree to indemnify and hold harmless ${LEGAL_COMPANY_NAME} and its affiliates from claims, damages, losses, and expenses (including reasonable attorneys' fees) arising from your use of the Services, your content, your violation of these Terms, or your violation of any rights of another.

16. Dispute Resolution and Governing Law
----------------------------------------
These Terms are governed by the laws of the State of ${LEGAL_GOVERNING_STATE}, ${LEGAL_GOVERNING_COUNTRY}, without regard to conflict-of-law principles. You agree that exclusive jurisdiction for disputes arising under these Terms shall lie in the state or federal courts located in ${LEGAL_GOVERNING_STATE}, and you consent to personal jurisdiction in those courts, except where applicable law requires otherwise.

Before filing a claim, you agree to contact us at ${LEGAL_CONTACT_EMAIL} to attempt informal resolution.

17. Changes to These Terms
--------------------------
We may modify these Terms from time to time. We will post the updated Terms with a revised "Last Updated" date and provide additional notice when required. Material changes may require your acceptance to continue using the Services. Continued use after the effective date constitutes acceptance unless prohibited by law.

18. Contact
-----------
${LEGAL_COMPANY_NAME}
Email: ${LEGAL_CONTACT_EMAIL}
Website: ${LEGAL_WEBSITE}`;

export const FITNESS_DISCLAIMER_CONTENT =
  intro('Fitness & Wellness Disclaimer') +
  `IMPORTANT — PLEASE READ CAREFULLY

This Fitness & Wellness Disclaimer applies to all workout programs, exercise instructions, wellness content, trends, and physical-activity features in the ${LEGAL_APP_NAME} application and related services operated by ${LEGAL_COMPANY_NAME}.

1. Not Medical Advice
---------------------
${LEGAL_APP_NAME} is intended for general fitness, wellness, and educational purposes only. The Services do not provide medical advice, diagnosis, treatment, or professional healthcare services. Nothing in the app replaces consultation with a qualified physician, registered dietitian, physical therapist, or other licensed healthcare provider.

2. Not a Medical Device
-----------------------
${LEGAL_APP_NAME} is not a medical device and is not FDA-cleared or FDA-approved (or equivalent in other jurisdictions) for diagnosis or treatment of disease.

3. Consult a Physician
----------------------
Consult a physician or qualified healthcare professional before beginning any exercise program, nutrition plan, or material change in physical activity, especially if you:
• Are pregnant or nursing;
• Have heart disease, high blood pressure, diabetes, or metabolic conditions;
• Have musculoskeletal injuries, joint problems, or chronic pain;
• Take medications that may affect exercise tolerance;
• Have been advised to limit physical activity; or
• Are unsure whether exercise is safe for you.

4. Assumption of Risk
---------------------
Physical exercise and sports activities involve inherent risks, including serious injury or death. You voluntarily assume all risks associated with your participation in workouts, training plans, and activities suggested or logged through the Services. You are solely responsible for choosing appropriate exercises, loads, volume, intensity, and environment.

5. Stop Exercising — Warning Signs
----------------------------------
Stop exercising immediately and seek medical attention if you experience chest pain, severe shortness of breath, dizziness, faintness, irregular heartbeat, sharp or persistent pain, nausea, or any symptom that concerns you. Do not ignore pain or discomfort.

6. Individual Results Vary
--------------------------
Fitness outcomes depend on many factors including genetics, adherence, sleep, nutrition, medical history, and training history. We do not guarantee specific results from any program or feature.

7. User Responsibility
----------------------
You are responsible for using equipment safely, maintaining proper form, warming up appropriately, staying hydrated, and exercising in a safe environment. Verify that any exercise is appropriate for your current fitness level and health status.

8. No Professional Relationship
-------------------------------
Use of ${LEGAL_APP_NAME} does not create a doctor-patient, therapist-client, or trainer-client professional relationship between you and ${LEGAL_COMPANY_NAME} or its personnel.

9. Limitation of Liability
--------------------------
To the fullest extent permitted by law, ${LEGAL_COMPANY_NAME} and its affiliates are not liable for injury, illness, death, or damages arising from your use of fitness or wellness features. See our Terms of Service for additional limitations.

10. Contact
-----------
Questions: ${LEGAL_CONTACT_EMAIL}`;

export const AI_DISCLAIMER_CONTENT =
  intro('Artificial Intelligence (AI) Disclaimer') +
  `This Artificial Intelligence Disclaimer applies to AI-generated workouts, meal suggestions, nutrition estimates, coaching messages, restaurant recommendations, macro predictions, and other machine-learning or large-language-model features in ${LEGAL_APP_NAME} ("AI Features") provided by ${LEGAL_COMPANY_NAME}.

1. AI May Contain Errors
------------------------
AI Features use automated systems, including third-party AI models (such as Google Gemini, OpenAI, Anthropic, and similar providers), to generate suggestions based on your inputs, profile, logs, and permitted data. AI output may be incomplete, outdated, biased, or incorrect. Calories, macros, portions, exercise selection, load recommendations, and coaching text should be verified before you rely on them.

2. Not Medical, Clinical, or Emergency Advice
---------------------------------------------
AI Features do not provide medical advice, clinical diagnosis, mental health treatment, or emergency guidance. Do not use AI Features for medical emergencies. Call emergency services (e.g., 911) in an emergency. Do not delay seeking professional care because of something the app or AI suggested.

3. Nutrition and Allergen Caution
---------------------------------
AI meal suggestions, barcode interpretations, restaurant picks, and food database matches may not reflect your allergies, intolerances, religious dietary rules, or medical dietary restrictions. Always read labels, confirm ingredients, and consult qualified professionals for medical nutrition therapy.

4. Workout and Training Caution
-------------------------------
AI-generated workouts and progressions may not account for all individual limitations, injuries, or recovery needs. Review exercises for safety and suitability. Modify or skip movements that cause pain or exceed your capability.

5. Your Responsibility
----------------------
You remain solely responsible for evaluating AI output and deciding whether to follow any recommendation. Use independent judgment and professional advice when appropriate.

6. No Guarantee of Accuracy
-----------------------------
We do not warrant that AI Features will be accurate, reliable, or suitable for your circumstances. Model behavior may change as providers update their systems.

7. Data Use for AI Features
-----------------------------
To provide AI Features, we may send relevant portions of your profile, logs, and prompts to AI service providers under contractual safeguards, as described in our Privacy Policy. Do not submit sensitive information you do not want processed for this purpose.

8. Enterprise and Partner Services
----------------------------------
When we integrate with nutrition databases (e.g., Nutritionix, USDA), payment processors (Stripe), health platforms (Apple Health, Google Health Connect), or future wearable partners, AI Features may incorporate data from those sources subject to your permissions and partner terms.

9. Contact
----------
Questions about AI Features: ${LEGAL_CONTACT_EMAIL}`;
