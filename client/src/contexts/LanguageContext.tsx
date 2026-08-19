import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getTranslationSource } from "@/lib/translation";

type Language = "en" | "ar";

const STORAGE_KEY = "al-hussam-language";
const ORIGINAL_TEXT = new WeakMap<Text, string>();
const LAST_TRANSLATED_TEXT = new WeakMap<Text, string>();

const ARABIC_COPY: Record<string, string> = {
  "Overview": "نظرة عامة",
  "Customers": "العملاء",
  "Inventory": "المخزون",
  "Tailoring orders": "طلبات التفصيل",
  "Point of Sale": "نقطة البيع",
  "Sales history": "سجل المبيعات",
  "Invoices": "الفواتير",
  "Staff & Payroll": "الموظفون والرواتب",
  "Shop Settings": "إعدادات المتجر",
  "Audit Trail": "سجل التدقيق",
  "Tailor ERP": "نظام الخياطة",
  "Main navigation": "التنقل الرئيسي",
  "More navigation": "المزيد من التنقل",
  "Signed-in user": "المستخدم المسجل",
  "ERP workspace": "مساحة عمل النظام",
  "Secure business workspace": "مساحة عمل تجارية آمنة",
  "Sign out": "تسجيل الخروج",
  "More": "المزيد",
  "More workspace tools": "المزيد من أدوات العمل",
  "Open the rest of your tailor business workspace.": "افتح بقية مساحة عمل متجر الخياطة.",
  "Team": "الفريق",
  "POS": "نقطة البيع",
  "Orders": "الطلبات",
  "English": "الإنجليزية",
  "Arabic": "العربية",
  "العربية": "العربية",
  "Switch to Arabic": "التبديل إلى العربية",
  "Switch to English": "التبديل إلى الإنجليزية",
  "Customers & measurements": "العملاء والمقاسات",
  "Client relations": "علاقات العملاء",
  "Client directory": "دليل العملاء",
  "New customer": "عميل جديد",
  "Edit": "تعديل",
  "Measurements": "المقاسات",
  "Outstanding balance": "الرصيد المستحق",
  "Email balance": "إرسال الرصيد بالبريد",
  "WhatsApp (future)": "واتساب (مستقبلاً)",
  "Find a client by name or phone…": "ابحث عن عميل بالاسم أو الهاتف…",
  "Point of sale": "نقطة البيع",
  "Add items → review the order → take payment": "أضف الأصناف ← راجع الطلب ← استلم الدفعة",
  "Ready to sell": "جاهز للبيع",
  "Ready": "جاهز",
  "End sales day": "إنهاء يوم المبيعات",
  "New sale": "بيع جديد",
  "Tailoring order": "طلب تفصيل",
  "Return": "مرتجع",
  "Customer": "العميل",
  "Saved": "محفوظ",
  "Register": "سجل البيع",
  "Walk-in customer": "عميل حاضر",
  "Optional customer · click to attach": "عميل اختياري · اضغط للربط",
  "Walk-in amount sale": "بيع بمبلغ مباشر",
  "Enter amount": "أدخل المبلغ",
  "Checkout": "إتمام البيع",
  "All Products": "كل المنتجات",
  "All products": "كل المنتجات",
  "Tailoring": "التفصيل",
  "View order": "عرض الطلب",
  "0 items in order": "0 أصناف في الطلب",
  "Tailoring mode": "وضع التفصيل",
  "Create a production order and collect the deposit.": "أنشئ طلب إنتاج واستلم العربون.",
  "New bespoke tailoring order": "طلب تفصيل جديد",
  "Choose customer": "اختر العميل",
  "Measurement version": "إصدار المقاسات",
  "Assigned tailor": "الخياط المسؤول",
  "Garment type": "نوع الملابس",
  "Pieces": "القطع",
  "Due date": "تاريخ التسليم",
  "Quoted order price (BHD, VAT-inclusive)": "السعر المتفق عليه (د.ب، شامل ضريبة القيمة المضافة)",
  "Fabric supplied by customer": "القماش مقدم من العميل",
  "No shop fabric is deducted for this order when selected.": "عند اختيار هذا الخيار لن يتم خصم قماش من مخزون المتجر.",
  "Counter & fitting notes": "ملاحظات الاستقبال والقياس",
  "Production notes": "ملاحظات الإنتاج",
  "Collect now": "المبلغ المحصل الآن",
  "Balance remaining": "الرصيد المتبقي",
  "Payment method": "طريقة الدفع",
  "Cash": "نقداً",
  "BenefitPay": "بنفت بي",
  "Bank transfer": "تحويل بنكي",
  "Card": "بطاقة",
  "Confirm order & invoice": "تأكيد الطلب والفاتورة",
  "Returns mode": "وضع المرتجعات",
  "Find a receipt, select items, and refund.": "ابحث عن الإيصال، اختر الأصناف، ثم نفّذ الاسترجاع.",
  "Return or refund an order": "إرجاع أو استرداد طلب",
  "Find receipt": "البحث عن الإيصال",
  "Refund method": "طريقة الاسترداد",
  "Confirm return & refund": "تأكيد المرتجع والاسترداد",
  "Item returns restore eligible stock. Amount refunds require a reason and record the chosen amount without inventing stock movements.": "تعيد مرتجعات الأصناف الكمية المؤهلة إلى المخزون. أما الاسترداد بمبلغ محدد فيتطلب سبباً ويسجل المبلغ دون إنشاء حركة مخزون غير حقيقية.",
  "Shop settings": "إعدادات المتجر",
  "Save settings": "حفظ الإعدادات",
  "Save and start using the ERP": "حفظ والبدء باستخدام النظام",
  "VAT enabled": "ضريبة القيمة المضافة مفعلة",
  "VAT rate": "نسبة ضريبة القيمة المضافة",
  "VAT registration number": "الرقم الضريبي",
  "Invoice": "فاتورة",
  "Receipt": "إيصال",
  "Issued": "تاريخ الإصدار",
  "Bill to": "الفاتورة إلى",
  "Payment": "الدفع",
  "Sale reference": "مرجع البيع",
  "Description": "الوصف",
  "Qty": "الكمية",
  "Unit price": "سعر الوحدة",
  "Line total": "إجمالي السطر",
  "Subtotal": "المجموع الفرعي",
  "Discount": "الخصم",
  "VAT": "ضريبة القيمة المضافة",
  "Total": "الإجمالي",
  "Thank you for your business.": "شكراً لتعاملكم معنا.",
  "Staff & payroll": "الموظفون والرواتب",
  "Staff access": "صلاحيات الموظفين",
  "Add staff": "إضافة موظف",
  "Payroll": "الرواتب",
  "Payslip history": "سجل قسائم الراتب",
  "Export payroll": "تصدير الرواتب",
  "Audit trail": "سجل التدقيق",
  "No business-changing events have been recorded yet.": "لم يتم تسجيل أي أحداث تغيّر بيانات العمل بعد.",
  "Loading…": "جارٍ التحميل…",
  "Loading": "جارٍ التحميل",
  "Save": "حفظ",
  "Cancel": "إلغاء",
  "Search": "بحث",
  "Close": "إغلاق",
  "Confirm": "تأكيد",
  "Delete": "حذف",
  "Update": "تحديث",
  "Status": "الحالة",
  "Date": "التاريخ",
  "Amount": "المبلغ",
  "Notes": "ملاحظات",
  "Full name": "الاسم الكامل",
  "Email": "البريد الإلكتروني",
  "Password": "كلمة المرور",
  "Check your email to confirm your account, then sign in below.": "تحقّق من بريدك الإلكتروني لتأكيد حسابك، ثم سجّل الدخول أدناه.",
  "An unexpected error occurred.": "حدث خطأ غير متوقع.",
  "Loading workspace…": "جاري تحميل مساحة العمل…",
  "Live": "مباشر",
  "Swipe left to view the remaining details and actions.": "اسحب لليسار لعرض بقية التفاصيل والإجراءات.",
  "Period": "الفترة",
  "Today": "اليوم",
  "Last 7 days": "آخر 7 أيام",
  "Last 30 days": "آخر 30 يومًا",
  "Last 90 days": "آخر 90 يومًا",
  "All time": "كل الوقت",
  "Custom period": "فترة مخصصة",
  "to": "إلى",
  "Revenue movement": "حركة الإيرادات",
  "Recorded revenue by order date for the selected period.": "الإيرادات المسجلة حسب تاريخ الطلب للفترة المحددة.",
  "No sales are recorded in this period.": "لا توجد مبيعات مسجلة في هذه الفترة.",
  "Revenue snapshots": "لقطات الإيرادات",
  "Independent rolling totals.": "مجاميع متداولة مستقلة.",
  "Recent sales": "المبيعات الحديثة",
  "The latest sales within the selected period.": "أحدث المبيعات خلال الفترة المحددة.",
  "No sales are recorded for this period.": "لا توجد مبيعات مسجلة لهذه الفترة.",
  "Materials at or below their replenishment threshold.": "المواد عند حد إعادة التوريد أو أقل.",
  "Team status": "حالة الفريق",
  "Today’s recorded attendance exceptions and workshop availability.": "استثناءات الحضور المسجلة اليوم وتوفر الورشة.",
  "Present today": "حاضرون اليوم",
  "Leave / half day": "إجازة / نصف يوم",
  "Absent today": "غائبون اليوم",
  "Top-selling lines": "الأصناف الأكثر مبيعًا",
  "Ranked by recorded revenue in the selected period.": "مرتبة حسب الإيرادات المسجلة في الفترة المحددة.",
  "No sale items are recorded for this period.": "لا توجد عناصر مباعة مسجلة لهذه الفترة.",
  "Create customer profile": "إنشاء ملف عميل",
  "The client will be immediately available at the counter.": "سيكون العميل متاحًا فورًا عند الكاونتر.",
  "Save customer": "حفظ العميل",
  "Recent client directory": "دليل العملاء الأخير",
  "Use POS customer search for the full directory.": "استخدم بحث عملاء POS لعرض الدليل الكامل.",
  "No customers yet. Create the first durable client record.": "لا يوجد عملاء بعد. أنشئ أول سجل عميل دائم.",
  "Measurement history": "سجل القياسات",
  "Choose a customer to view saved fitting versions.": "اختر عميلًا لعرض الإصدارات المحفوظة للقياسات.",
  "Choose a customer to manage their profile and fitting history.": "اختر عميلًا لإدارة ملفه وسجل قياساته.",
  "Select a customer from the directory.": "اختر عميلًا من الدليل.",
  "No measurement version is saved for this client yet.": "لا توجد نسخة قياسات محفوظة لهذا العميل بعد.",
  "No saved measurement values yet. Use Measurements to add them.": "لا توجد قيم قياسات محفوظة بعد. استخدم القياسات لإضافتها.",
  "Notes:": "ملاحظات:",
  "Material": "مادة",
  "Add material": "إضافة مادة",
  "Opening quantity is recorded as its own inventory movement.": "يُسجَّل رصيد الافتتاح كحركة مخزون مستقلة.",
  "Save material": "حفظ المادة",
  "On-hand materials": "المواد في المخزون",
  "Review material details at a glance, then edit product data or record a documented stock correction.": "راجع تفاصيل المادة بسرعة، ثم عدّل بيانات المنتج أو سجّل تصحيح مخزون موثق.",
  "Swipe the table left to view balances, thresholds, costs, and actions.": "اسحب الجدول إلى اليسار لعرض الأرصدة والحدود والتكاليف والإجراءات.",
  "No materials match that search.": "لا توجد مواد تطابق هذا البحث.",
  "Reorder attention": "تنبيه إعادة الطلب",
  "Adjust": "تعديل",
  "Edit material": "تعديل المادة",
  "Changing these fields does not alter stock on hand.": "تغيير هذه الحقول لا يغيّر رصيد المخزون المتوفر.",
  "Save material changes": "حفظ تغييرات المادة",
  "Adjust stock": "تعديل المخزون",
  "Documented adjustment": "تعديل موثق",
  "Use a positive value to add stock and a negative value to remove stock. The adjustment will be retained in the stock-movement history.": "استخدم قيمة موجبة لإضافة مخزون وقيمة سالبة لإزالته. سيُحتفظ بهذا التعديل في سجل حركات المخزون.",
  "Record stock adjustment": "تسجيل تعديل المخزون",
  "Fabric": "قماش",
  "Lining": "بطانة",
  "Buttons": "أزرار",
  "Thread": "خيط",
  "Accessory": "إكسسوار",
  "Other": "أخرى",
  "Services & products": "خدمات ومنتجات",
  "Current sale": "البيع الحالي",
  "Add catalog items to begin.": "أضف عناصر من الكتالوج للبدء.",
  "Remove": "إزالة",
  "Complete sale & issue invoice": "إكمال البيع وإصدار الفاتورة",
  "Find an invoice": "ابحث عن فاتورة",
  "Every change runs against the invoice records on the server. Search by invoice, sale, client, or phone.": "يُطبَّق كل تغيير على سجلات الفواتير على الخادم. ابحث حسب الفاتورة أو البيع أو العميل أو رقم الهاتف.",
  "All statuses": "جميع الحالات",
  "Paid": "مدفوعة",
  "Partial": "مدفوعة جزئياً",
  "Unpaid": "غير مدفوعة",
  "All sources": "جميع المصادر",
  "Counter": "الكاونتر",
  "Manual": "يدوي",
  "All payment methods": "جميع طرق الدفع",
  "Credit card": "بطاقة ائتمان",
  "Reset": "إعادة تعيين",
  "Swipe the table left to reach the invoice amount, status, and Print action.": "اسحب الجدول إلى اليسار للوصول إلى مبلغ الفاتورة والحالة وإجراء الطباعة.",
  "Loading invoices…": "جارٍ تحميل الفواتير…",
  "Print": "طباعة",
  "No invoices match these filters.": "لا توجد فواتير تطابق هذه المرشحات.",
  "Print invoice": "طباعة الفاتورة",
  "Review the invoice, then open a clean print window to print it or save it as PDF.": "راجع الفاتورة، ثم افتح نافذة طباعة نظيفة لطبعها أو حفظها كملف PDF.",
  "Tax invoice": "فاتورة ضريبية",
  "Print receipt": "طباعة الإيصال",
  "Share": "مشاركة",
  "Create staff profile": "إنشاء ملف موظف",
  "Save staff profile": "حفظ ملف الموظف",
  "Staff directory": "دليل الموظفين",
  "Base salary and commission settings used by payroll calculations.": "إعدادات الراتب الأساسي والعمولات المستخدمة في حسابات الرواتب.",
  "Linked": "مرتبط",
  "Not linked": "غير مرتبط",
  "Pay-period calculator": "حاسبة فترة الرواتب",
  "Choose a staff member and month, review the calculated bonus, then add allowances and deductions before creating a payslip.": "اختر موظفًا وشهرًا، راجع المكافأة المحسوبة، ثم أضف البدلات والخصومات قبل إنشاء قسيمة الراتب.",
  "Choose Calculate pay beside a staff member to begin.": "اضغط على 'حساب الراتب' بجانب اسم الموظف للبدء.",
  "Pay period": "فترة الرواتب",
  "Allowances (BHD)": "بدلات (د.ب)",
  "Overtime (BHD)": "العمل الإضافي (د.ب)",
  "Deductions (BHD)": "خصومات (د.ب)",
  "Deduction details": "تفاصيل الخصم",
  "Payslip notes": "ملاحظات قسيمة الراتب",
  "Base": "الراتب الأساسي",
  "Performance bonus": "مكافأة الأداء",
  "Gross before adjustments": "الإجمالي قبل التعديلات",
  "Recorded pay periods with transparent salary breakdowns.": "فترات صرف مسجلة مع تفصيل شفاف للرواتب.",
  "Loading payroll…": "جارٍ تحميل الرواتب…",
  "Salary payslip": "قسيمة الراتب",
  "Base salary": "الراتب الأساسي",
  "Allowances": "البدلات",
  "Overtime": "العمل الإضافي",
  "Deductions": "الاستقطاعات",
  "Net salary": "صافي الراتب",
  "Payslip": "قسيمة الراتب",
  "Owner overview": "نظرة عامة للمالك",
  "Tailoring desk": "مكتب التفصيل",
  "A filterable operating view of revenue, stock, client activity, sales performance, and workforce status.": "عرض تشغيلي قابل للتصفية للإيرادات والمخزون ونشاط العملاء وأداء المبيعات وحالة القوى العاملة.",
  "Dashboard period": "فترة لوحة المعلومات",
  "Custom period start date": "تاريخ بدء الفترة المخصصة",
  "Custom period end date": "تاريخ انتهاء الفترة المخصصة",
  "Revenue": "الإيرادات",
  "Completed sales": "المبيعات المكتملة",
  "Average order": "متوسط الطلب",
  "Registered clients": "العملاء المسجلون",
  "Store customer contacts and retain measurement versions for every fitting.": "خزن جهات اتصال العملاء واحتفظ بنسخ القياسات لكل جلسة قياس.",
  "Client name": "اسم العميل",
  "Phone": "الهاتف",
  "Address": "العنوان",
  "Materials": "الخامات",
  "Inventory control": "مراقبة المخزون",
  "Maintain material details, record traceable stock corrections, and sell these same live materials directly at the POS.": "حافظ على تفاصيل الخامات، سجّل تصحيحات المخزون القابلة للتتبع، وبيع هذه الخامات نفسها مباشرةً عند نقطة البيع.",
  "Search by code, material, category, color, or unit…": "ابحث بحسب الكود، الخامة، الفئة، اللون، أو الوحدة…",
  "Reason / notes": "السبب / ملاحظات",
  "Stock code": "رمز المخزون",
  "Material name": "اسم الخامة",
  "Color": "اللون",
  "Width (inches)": "العرض (بوصة)",
  "Opening quantity": "الكمية الافتتاحية",
  "Minimum threshold": "الحد الأدنى",
  "Cost per unit": "التكلفة لكل وحدة",
  "Unit": "الوحدة",
  "Counter workspace": "مساحة عمل الكاونتر",
  "Financial records": "السجلات المالية",
  "Search and filter issued invoices, then open any result in a print-ready format.": "ابحث وفرّز الفواتير الصادرة ثم افتح أي نتيجة بصيغة جاهزة للطباعة.",
  "Invoice, sale, client, or phone…": "فاتورة، بيع، عميل، أو هاتف…",
  "Filter invoice status": "تصفية حالة الفاتورة",
  "Filter invoice source": "تصفية مصدر الفاتورة",
  "Filter payment method": "تصفية طريقة الدفع",
  "Invoice start date": "تاريخ بدء الفاتورة",
  "Invoice end date": "تاريخ انتهاء الفاتورة",
  "Workforce": "القوى العاملة",
  "Create staff profiles, calculate a pay period, record deductions, and produce payslips.": "أنشئ ملفات الموظفين، احسب فترة الرواتب، سجّل الاستقطاعات، وأصدر قسائم الرواتب.",
  "Job title": "المسمى الوظيفي",
  "Base salary (BHD)": "الراتب الأساسي (د.ب)",
  "Commission rate": "نسبة العمولة",
  "Reason for deductions": "سبب الاستقطاعات",
  "Optional payroll note": "ملاحظة اختيارية للرواتب",
  "Shop name": "اسم المتجر",
  "Arabic shop name": "اسم المتجر بالعربية",
  "Commercial registration": "السجل التجاري",
  "Invoice prefix": "بادئة الفاتورة",
  "Business address": "عنوان النشاط التجاري",
  "Administration": "الإدارة",
  "Review timestamped business actions to support operational accountability.": "راجع الإجراءات التجارية المزودة بعلامات زمنية لدعم المساءلة التشغيلية.",
  "Customer saved": "تم حفظ العميل",
  "Material added": "تمت إضافة المادة",
  "Material details updated": "تم تحديث تفاصيل المادة",
  "Stock adjustment recorded": "تم تسجيل تعديل المخزون",
  "Your browser blocked the print window. Please allow pop-ups and try again.": "متصفحك حظر نافذة الطباعة. الرجاء السماح بالنوافذ المنبثقة والمحاولة مرة أخرى.",
  "Add a customer phone number before opening WhatsApp.": "أضف رقم هاتف العميل قبل فتح WhatsApp.",
  "Staff profile created": "تم إنشاء ملف الموظف",
  "Allow pop-ups to print the payslip.": "اسمح بالنوافذ المنبثقة لطباعة قسيمة الراتب.",
  "Shop settings saved": "تم حفظ إعدادات المتجر",
  "Loading operational data…": "جارٍ تحميل البيانات التشغيلية…",
  "Search by client name or phone number.": "ابحث باسم العميل أو رقم الهاتف.",
  "Searching client directory…": "جارٍ البحث في دليل العملاء…",
  "Edit customer profile": "تعديل ملف العميل",
  "Add measurement version": "أضف إصدار القياس",
  "Previous fitting data is retained and this version becomes the newest record.": "تُحتفظ ببيانات القياسات السابقة ويصبح هذا الإصدار أحدث سجل.",
  "Save fitting version": "حفظ إصدار القياس",
  "Customer measurement history will appear here.": "سيظهر هنا تاريخ قياسات العميل.",
  "No measurement version has been saved yet.": "لم يتم حفظ أي نسخة من القياسات بعد.",
  "Client notes": "ملاحظات العميل",
  "Maintain customer contacts and retain a traceable fitting history for every bespoke client.": "حافظ على جهات اتصال العملاء واحتفظ بسجل قياسات قابل للتتبع لكل عميل مفصل.",
  "Fit preference": "تفضيل الملاءمة",
  "Collar style": "نمط الياقة",
  "Pocket style": "نمط الجيب",
  "Effective date": "تاريخ السريان",
  "Tailor notes": "ملاحظات الخياط",
  "WhatsApp delivery will be connected in a future integration": "سيتم ربط خدمة التوصيل عبر WhatsApp في تكامل مستقبلي",
  "Customer profile created": "تم إنشاء ملف العميل",
  "Customer profile updated": "تم تحديث ملف العميل",
  "Measurement version saved": "تم حفظ نسخة القياسات",
  "Balance email prepared": "تم إعداد بريد إلكتروني للرصيد",
  "Role name": "اسم الدور",
  "Available": "متاح",
  "Short description": "وصف مختصر",
  "Allowed work areas": "مناطق العمل المسموح بها",
  "Loading owner settings…": "جارٍ تحميل إعدادات المالك…",
  "Owner control centre": "مركز تحكم المالك",
  "You control access with roles you create. For every request, choose one of your roles and approve.": "أنت تتحكم في الوصول عبر الأدوار التي تنشئها. لكل طلب، اختر أحد أدوارك ووافق عليه.",
  "Copy sign-in link": "نسخ رابط تسجيل الدخول",
  "Manage roles": "إدارة الأدوار",
  "Your roles": "أدوارك",
  "Create and maintain the roles that appear in staff approvals. No preset roles are used.": "أنشئ وحافظ على الأدوار التي تظهر في موافقات الموظفين. لا تُستخدم أدوار مُعدة مسبقًا.",
  "Create role": "إنشاء دور",
  "Choose the responsibilities that this role should have.": "اختر المسؤوليات التي يجب أن يمتلكها هذا الدور.",
  "No roles yet. Create your first role before approving staff.": "لا توجد أدوار بعد. أنشئ دورك الأول قبل الموافقة على الموظفين.",
  "Edit shop details": "تحرير تفاصيل المتجر",
  "Business profile": "ملف النشاط التجاري",
  "Information printed on invoices and shown throughout the ERP.": "المعلومات المطبوعة على الفواتير والمعروضة في كامل نظام ERP.",
  "VAT rate (%)": "نسبة ضريبة القيمة المضافة (%)",
  "Save business profile": "حفظ ملف النشاط التجاري",
  "Services available in POS": "الخدمات المتاحة في نقاط البيع",
  "Add the services staff can sell. Inventory remains separate, with an optional link when a sale should reduce material stock.": "أضف الخدمات التي يمكن للموظفين بيعها. يبقى المخزون منفصلًا مع رابط اختياري لخفض مخزون المواد عند البيع.",
  "Add service": "إضافة خدمة",
  "Add service to POS": "إضافة الخدمة إلى نقاط البيع",
  "Use this for tailoring, alterations, fabric, or accessories. Staff will see it as a sale tile.": "استخدم هذا للخياطة، التعديلات، الأقمشة أو الإكسسوارات. سيرى الموظفون هذا كبطاقة بيع.",
  "SKU / short code": "SKU / كود مختصر",
  "Service name": "اسم الخدمة",
  "Category": "الفئة",
  "Alteration": "تعديلات",
  "Price (BHD)": "السعر (BHD)",
  "Optional inventory link": "ربط اختياري بالمخزون",
  "Standalone service — no stock deduction": "خدمة مستقلة — لا يوجد خصم من المخزون",
  "Link a material only when selling this service should reduce its stock.": "اربط مادة فقط عندما يؤدي بيع هذه الخدمة إلى تخفيض مخزونها.",
  "Material used per sale (optional)": "المادة المستخدمة لكل بيع (اختياري)",
  "Description (optional)": "الوصف (اختياري)",
  "No services have been added yet. Add at least one service before using product tiles in the POS. Walk-in amount sales are available without a catalog.": "لم تُضف أي خدمات بعد. أضف خدمة واحدة على الأقل قبل استخدام بطاقات المنتجات في نقطة البيع. يمكن إجراء مبيعات العملاء المتجولين بمبلغ دون الحاجة إلى كتالوج.",
  "Share the sign-in link. When someone signs in, select one of your roles and approve them.": "شارك رابط تسجيل الدخول. عندما يسجل شخص الدخول، اختر أحد أدوارك ووافق عليه.",
  "Approve": "الموافقة",
  "No requests waiting. Staff appear here after they sign in with the link.": "لا توجد طلبات قيد الانتظار. يظهر الموظفون هنا بعد أن يسجلوا الدخول عبر الرابط.",
  "Current access": "الوصول الحالي",
  "Review existing staff only when their responsibility changes.": "راجع الموظفين الحاليين فقط عندما تتغير مسؤولياتهم.",
  "Owner account": "حساب المالك",
  "Manage": "إدارة",
  "More options": "المزيد من الخيارات",
  "Create a custom role": "إنشاء دور مخصص",
  "Reject request": "رفض الطلب",
  "Manage access": "إدارة الوصول",
  "Role": "الدور",
  "Role is active": "الدور نشط",
  "Payroll profile": "ملف الرواتب",
  "Choose a payroll profile…": "اختر ملف الرواتب…",
  "Link payroll profile": "ربط ملف الرواتب",
  "Unlink payroll profile": "إلغاء ربط ملف الرواتب",
  "Linking connects this login to the same staff record used for attendance, production, and payslips.": "يقوم الربط بتوصيل تسجيل الدخول هذا بنفس سجل الموظف المستخدم للحضور والإنتاج وكشوف الرواتب.",
  "Save access": "حفظ الوصول",
  "Remove user": "إزالة المستخدم",
  "Revokes this person’s ERP profile and access. Sales, invoices, payroll, and audit records are kept.": "يلغي ملف هذا الشخص في ERP ووصوله. تُحفظ سجلات المبيعات والفواتير والرواتب والتدقيق.",
  "Remove user?": "إزالة المستخدم?",
  "Create custom role": "إنشاء دور مخصص",
  "Edit role": "تعديل الدور",
  "Changes apply to active assignees immediately.": "تُطبق التغييرات على المكلفين النشطين فورًا.",
  "Describe this person’s responsibility.": "وصف مسؤولية هذا الشخص.",
  "Optional": "اختياري",
  "Short description shown only in setup.": "وصف مختصر يظهر فقط أثناء الإعداد.",
  "Choose at least one responsibility.": "اختر مسؤولية واحدة على الأقل.",
  "Shop profile saved": "تم حفظ ملف المتجر",
  "Role created": "تم إنشاء الدور",
  "Role updated": "تم تحديث الدور",
  "Staff access updated": "تم تحديث صلاحيات الموظفين",
  "Payroll profile linked to staff access": "تم ربط ملف الرواتب بوصول الموظف",
  "Payroll profile unlinked": "تم إلغاء ربط ملف الرواتب",
  "User removed from ERP access": "تمت إزالة وصول المستخدم من ERP",
  "Access approved": "تمت الموافقة على الوصول",
  "Access request rejected": "تم رفض طلب الوصول",
  "Custom access approved": "تمت الموافقة على الوصول المخصص",
  "Service added to POS": "تمت إضافة الخدمة إلى POS",
  "Secure sign-in link copied": "تم نسخ رابط تسجيل الدخول الآمن",
  "Unable to copy the link": "تعذر نسخ الرابط",
  "Choose one of your roles before approving.": "اختر أحد أدوارك قبل الموافقة.",
  "Choose one of your roles.": "اختر أحد أدوارك.",
  "Choose a payroll profile first.": "اختر ملف تعريف الرواتب أولاً.",
  "Financial control": "التحكم المالي",
  "Sales history & reports": "سجل المبيعات والتقارير",
  "Review every POS and tailoring payment, reconcile the register, and export a branded monthly register. New operational sales are created only through POS.": "راجع كافة مدفوعات نقاط البيع ومدفوعات التفصيل، وطابق السجل، وصدر سجلًا شهريًا يحمل علامتك التجارية. تُنشأ المبيعات التشغيلية الجديدة فقط عبر POS.",
  "Open POS": "افتح POS",
  "Find a transaction": "ابحث عن معاملة",
  "Use multiple filters to trace a payment, reconcile the counter, or open its linked invoice.": "استخدم مرشحات متعددة لتتبع دفعة، ومطابقة سجل الصندوق، أو لفتح فاتورتها المرتبطة.",
  "Historical manual": "دليل تاريخي",
  "Sales register": "سجل المبيعات",
  "Loading sales history…": "جارٍ تحميل سجل المبيعات…",
  "Reference": "مرجع",
  "Source": "المصدر",
  "No sales match these filters.": "لا توجد مبيعات تطابق هذه الفلاتر.",
  "Monthly report": "التقرير الشهري",
  "Branded Excel-ready export": "تصدير Excel جاهز بعلامة تجارية",
  "The CSV includes the shop identity, report month, totals, generated time, and detailed transaction register.": "يتضمن ملف CSV هوية المتجر، شهر التقرير، الإجماليات، وقت الإنشاء، وسجل المعاملات المفصّل.",
  "Export CSV": "تصدير CSV",
  "Preparing monthly report…": "جارٍ إعداد التقرير الشهري…",
  "Sales by source": "المبيعات حسب المصدر",
  "No sales in this month.": "لا توجد مبيعات في هذا الشهر.",
  "Payment mix": "توزيع طرق الدفع",
  "Top recorded sale lines": "أفضل بنود المبيعات المسجلة",
  "No sale lines in this month.": "لا توجد بنود مبيعات في هذا الشهر.",
  "Sale, customer, or phone…": "عملية بيع، عميل، أو هاتف…",
  "Filter sale source": "تصفية حسب مصدر البيع",
  "Filter payment status": "تصفية حسب حالة الدفع",
  "Sales start date": "تاريخ بدء المبيعات",
  "Sales end date": "تاريخ انتهاء المبيعات",
  "Report month": "شهر التقرير",
  "Recorded revenue": "الإيراد المسجل",
  "Sales": "المبيعات",
  "Average sale": "متوسط البيع",
  "Partial / unpaid": "مدفوع جزئيًا / غير مدفوع",
  "Branded monthly CSV downloaded": "تم تنزيل ملف CSV الشهري بعلامة تجارية",
  "Loading tailoring orders…": "جارٍ تحميل طلبات التفصيل…",
  "Bespoke production": "إنتاج حسب الطلب",
  "Track tailoring work from confirmation through fitting and handover. New tailoring orders are created in Point of Sale.": "تتبّع أعمال التفصيل من التأكيد وحتى القياس والتسليم. تُنشأ طلبات التفصيل الجديدة في نقطة البيع.",
  "Open production orders": "طلبات الإنتاج المفتوحة",
  "Awaiting a production stage or handover.": "في انتظار مرحلة إنتاج أو التسليم.",
  "In workshop": "في الورشة",
  "Currently cutting, stitching, or fitting.": "جاري القص أو الخياطة أو القياس.",
  "Ready for handover": "جاهز للتسليم",
  "Completed garments awaiting collection.": "ملابس مكتملة بانتظار الاستلام.",
  "Handed over": "تم التسليم",
  "Completed bespoke orders.": "طلبات حسب الطلب المكتملة.",
  "Production board": "لوحة الإنتاج",
  "Every order keeps its client, measurement version, tailor, due date, and production notes together.": "يحافظ كل طلب على بيانات العميل، نسخة القياسات، الخياط، تاريخ الاستحقاق، وملاحظات الإنتاج معًا.",
  "No tailoring orders in production": "لا توجد طلبات تفصيل في الإنتاج",
  "Open production details →": "فتح تفاصيل الإنتاج →",
  "Client": "العميل",
  "Order notes": "ملاحظات الطلب",
  "Production stage": "مرحلة الإنتاج",
  "Unassigned": "غير معين",
  "Save production update": "حفظ تحديث الإنتاج",
  "Production / fitting / handover notes": "ملاحظات الإنتاج / القياس / التسليم",
  "Production order updated": "تم تحديث أمر الإنتاج",
  "Loading register…": "جارٍ تحميل السجل…",
  "Choose a customer": "اختر عميلًا",
  "No customer record attached": "لا يوجد سجل عميل مرفق",
  "Searching customers…": "جارٍ البحث عن العملاء…",
  "No customers match this search.": "لا يطابق أي عميل هذا البحث.",
  "Saved orders": "الطلبات المحفوظة",
  "No saved orders": "لا توجد طلبات محفوظة",
  "Save an order when a customer needs more time, then reopen it later.": "احفظ الطلب عندما يحتاج العميل إلى وقت إضافي، ثم أعد فتحه لاحقًا.",
  "Number entry": "إدخال رقم",
  "End of day": "نهاية اليوم",
  "Finish sales day": "إنهاء يوم المبيعات",
  "Optional: count the cash in the drawer before finishing. Enter 0 if you do not use one.": "اختياري: عد النقود في درج النقود قبل الإنهاء. أدخل 0 إذا لم تستخدم درج نقود.",
  "Cash counted at close": "تم عد النقود عند الإغلاق",
  "No services are set up yet": "لم تُعدّ الخدمات بعد",
  "Add the services your shop sells in Shop Settings. They will appear here as sale tiles. For a one-off walk-in sale, use the amount box above.": "أضف الخدمات التي يبيعها متجرك في إعدادات المتجر. ستظهر هنا كبطاقات بيع. لبيع عابر لمرة واحدة، استخدم خانة المبلغ أعلاه.",
  "Set up POS services": "إعداد خدمات نقطة البيع",
  "No services match that search.": "لا توجد خدمات تطابق هذا البحث.",
  "Enter the total directly when the customer does not need a product or customer record.": "أدخل الإجمالي مباشرة عندما لا يحتاج العميل إلى منتج أو سجل عميل.",
  "Products": "المنتجات",
  "Order screen": "شاشة الطلب",
  "Current order": "الطلب الحالي",
  "Select a line to edit it with the keypad or keyboard.": "اختر سطراً لتعديله باستخدام لوحة الأرقام أو لوحة المفاتيح.",
  "Clear all": "مسح الكل",
  "Order is empty": "الطلب فارغ",
  "Add products": "إضافة منتجات",
  "Editing line": "جاري تعديل السطر",
  "Edit with keypad": "التعديل باستخدام لوحة الأرقام",
  "Order discount": "خصم على الطلب",
  "Apply": "تطبيق",
  "Total due": "الإجمالي المستحق",
  "Hold order": "تعليق الطلب",
  "Payment screen": "شاشة الدفع",
  "Amount due": "المبلغ المستحق",
  "Paid now": "المبلغ المدفوع الآن",
  "Remaining": "المتبقي",
  "Selected payment": "طريقة الدفع المختارة",
  "Edit amount": "تعديل المبلغ",
  "Payment lines": "أسطر الدفع",
  "Split tender if needed.": "قسّم الدفع إذا لزم الأمر.",
  "Split": "قسّم",
  "The job and first payment are created together and enter production as confirmed.": "يتم إنشاء العمل والدفعة الأولى معًا وتدخل الإنتاج بحالة مؤكدة.",
  "Production brief": "موجز الإنتاج",
  "A partial payment is recorded as a deposit and the remaining balance stays visible on the production order.": "يُسجَّل السداد الجزئي كدفعة مقدمة ويظل الرصيد المتبقي مرئيًا في أمر الإنتاج.",
  "Search an original POS or tailoring receipt and restock inventory automatically.": "ابحث عن إيصال نقطة البيع الأصلي أو إيصال التفصيل وأعد تخزين المخزون تلقائيًا.",
  "Searching receipt…": "جارٍ البحث عن الإيصال…",
  "Return items": "إرجاع الأصناف",
  "Refund amount": "مبلغ الاسترداد",
  "No returnable receipt found. Check the sale number and try again.": "لم يتم العثور على إيصال قابل للإرجاع. تحقق من رقم البيع وحاول مرة أخرى.",
  "Clear": "مسح",
  "Search name or phone": "ابحث بالاسم أو الهاتف",
  "Number entry keypad": "لوحة إدخال الأرقام",
  "Search products or code · / to focus": "ابحث عن منتجات أو رمز · / للتركيز",
  "Search products or code": "ابحث عن منتجات أو رمز",
  "Line discounts": "خصومات السطر",
  "Promo code": "رمز ترويجي",
  "Order note or cashier comment (optional)": "ملاحظة الطلب أو تعليق الصراف (اختياري)",
  "Record fabric type, quantity, or condition (optional)": "سجل نوع القماش، الكمية، أو الحالة (اختياري)",
  "Quoted order price": "سعر الطلب المقتبس",
  "Refund amount (BHD)": "مبلغ الاسترداد (BHD)",
  "Reason": "السبب",
  "Customer request, price adjustment…": "طلب العميل، تعديل السعر…",
  "Return quantity": "كمية الإرجاع",
  "Clear number": "مسح الرقم",
  "Backspace": "حذف للخلف",
  "Apply number": "تطبيق الرقم",
  "Invoice was issued, but the print window could not be opened. Use Invoices to print it.": "تم إصدار الفاتورة، لكن نافذة الطباعة لم تُفتح. استخدم الفواتير لطبعها.",
  "Sales are ready": "المبيعات جاهزة",
  "POS session closed": "تم إغلاق جلسة نقاط البيع",
  "Held order cancelled": "تم إلغاء الطلب المعلق",
  "Finish or clear the current product order before starting a walk-in amount sale.": "أكمل أو امسح طلب المنتج الحالي قبل بدء بيع بمبلغ لزبون متجول.",
  "Payment lines cannot exceed the order total.": "أسطر الدفع لا يمكن أن تتجاوز إجمالي الطلب.",
  "Sale saved on this device. It will sync when internet returns.": "تم حفظ البيع على هذا الجهاز. سيُزامن عند عودة الإنترنت.",
  "Enter a walk-in amount first.": "أدخل مبلغ الزبون المتجول أولاً.",
  "Payment lines cannot exceed the walk-in amount.": "أسطر الدفع لا يمكن أن تتجاوز مبلغ الزبون المتجول.",
  "Collect the full walk-in amount before checkout.": "قم بتحصيل كامل مبلغ الزبون المتجول قبل إتمام الدفع.",
  "Choose one payment method for a walk-in amount sale.": "اختر طريقة دفع واحدة لبيع بمبلغ لزبون متجول.",
  "Walk-in sale saved on this device. It will sync when internet returns.": "تم حفظ بيع الزبون المتجول على هذا الجهاز. سيُزامن عند عودة الإنترنت.",
  "Sales are still starting. Please try again in a moment.": "لا تزال عمليات المبيعات قيد البدء. يرجى المحاولة مرة أخرى بعد لحظة.",
  "Choose the customer, saved measurement, tailor, garment, quote, and payment before issuing the order.": "اختر العميل، القياس المحفوظ، الخياط، القطعة، عرض السعر، وطريقة الدفع قبل إصدار الطلب.",
  "Choose at least one item to return.": "اختر بندًا واحدًا على الأقل للإرجاع.",
  "Enter a refund amount and reason.": "أدخل مبلغ الاسترداد والسبب.",
  "Discount code could not be applied.": "تعذر تطبيق رمز الخصم.",
  "Across the last 7 days": "خلال آخر 7 أيام",
  "Across the last 30 days": "خلال آخر 30 يومًا",
  "Across the last 90 days": "خلال آخر 90 يومًا",
  "Across today": "خلال اليوم",
  "Across all time": "طوال الفترة",
  "Across the custom period": "خلال الفترة المخصصة",
  "Across the selected period": "خلال الفترة المحددة",
  "Orders created in this period": "الطلبات المنشأة في هذه الفترة",
  "Average transaction value": "متوسط قيمة المعاملة",
  "Customer relationships on record": "علاقات العملاء المسجلة",
  "SALE": "البيع",
  "Sale": "البيع",
  "Low-stock attention": "تنبيه نقص المخزون",
  "No low-stock materials are currently flagged.": "لا توجد مواد منخفضة المخزون حاليًا.",
  "Credit Card": "بطاقة ائتمان",
  "credit card": "بطاقة ائتمان",
  "cash": "نقدًا",
  "bank transfer": "تحويل بنكي",
  "Walk-in sale": "بيع عميل حاضر",
  "draft": "مسودة",
  "confirmed": "مؤكد",
  "cutting": "قص",
  "stitching": "خياطة",
  "fitting": "قياس",
  "ready": "جاهز",
  "handed over": "تم التسليم",
  "cancelled": "ملغى",
  "piece": "قطعة",
  "pieces": "قطع",
  "not selected": "غير محدد",
  "Tailor not assigned": "لم يُعيّن خياط",
  "No due date": "لا يوجد تاريخ تسليم",
  "No order notes.": "لا توجد ملاحظات على الطلب.",
  "Starting sales": "جارٍ بدء المبيعات",
  "Starting": "جارٍ البدء",
  "Not started": "لم يبدأ",
  "Start selling": "بدء البيع",
  "Offline sales mode": "وضع المبيعات دون اتصال",
  "Online": "متصل",
  "Offline": "دون اتصال",
  "Syncing…": "جارٍ المزامنة…",
  "Sync now": "مزامنة الآن",
  "Offline ready": "دون اتصال — جاهز",
  "Sales are saved on this device and will sync when internet returns.": "تُحفظ المبيعات على هذا الجهاز وتُزامن عند عودة الإنترنت.",
  "Add items or enter a walk-in amount": "أضف الأصناف أو أدخل مبلغ العميل الحاضر",
  "waiting to sync": "بانتظار المزامنة",
  "New staff requests": "طلبات الموظفين الجديدة",
  "linked to": "مرتبط بـ",
  "standalone": "مستقل",
  "Payroll:": "الرواتب:",
  "admin": "مسؤول النظام",
  "Shop manager": "مدير المتجر",
  "Choose your role…": "اختر دورك…",
  "Create a role first": "أنشئ دورًا أولًا",
  "Select a customer": "اختر عميلًا",
  "Standard fit": "ملاءمة قياسية",
  "Not set": "غير محدد",
  "Neck (in)": "الرقبة (بوصة)",
  "Chest (in)": "الصدر (بوصة)",
  "Waist (in)": "الخصر (بوصة)",
  "Shoulder (in)": "الكتف (بوصة)",
  "Sleeve (in)": "الكم (بوصة)",
  "Length (in)": "الطول (بوصة)",
  "Add an email to send this balance.": "أضف بريدًا إلكترونيًا لإرسال هذا الرصيد.",
  "No phone": "لا يوجد هاتف",
  "No phone recorded": "لا يوجد هاتف مسجل",
  "Invoice pending": "الفاتورة قيد الانتظار",
  "Sale archived": "البيع مؤرشف",
  "Archived customer": "عميل مؤرشف",
  "Archived": "مؤرشف",
  "counter": "الكاونتر",
  "manual": "يدوي",
  "tailoring": "التفصيل",
  "paid": "مدفوعة",
  "partial": "مدفوعة جزئيًا",
  "unpaid": "غير مدفوعة",
  "benefitpay": "بنفت بي",
  "Calculate pay": "حساب الراتب",
  "Selected": "محدد",
  "linked": "مرتبط",
  "Code": "الرمز",
  "Material / Fabric Name": "اسم المادة / القماش",
  "Color & Width": "اللون والعرض",
  "Available Balance": "الرصيد المتاح",
  "Min Threshold": "الحد الأدنى",
  "Cost / Unit": "التكلفة / الوحدة",
  "Actions": "الإجراءات",
  "Width not set": "العرض غير محدد",
  "Meters": "أمتار",
  "unit": "وحدة",
  "fabric": "قماش",
  "lining": "بطانة",
  "buttons": "أزرار",
  "thread": "خيط",
  "accessory": "إكسسوار",
  "other": "أخرى",
  "Measurement": "القياس",
  "version": "الإصدار",
  "Due": "التسليم",
  "Open production details": "فتح تفاصيل الإنتاج",
  "No note": "لا توجد ملاحظة",
  "No matching transactions": "لا توجد معاملات مطابقة",
  "Delivery prepared": "تم إعداد التسليم",
};

export function getStoredLanguage(): Language {
  if (typeof window === "undefined") return "en";
  try {
    return window.localStorage?.getItem(STORAGE_KEY) === "ar" ? "ar" : "en";
  } catch {
    return "en";
  }
}

const ARABIC_MONTHS: Record<string, string> = {
  Jan: "يناير",
  Feb: "فبراير",
  Mar: "مارس",
  Apr: "أبريل",
  May: "مايو",
  Jun: "يونيو",
  Jul: "يوليو",
  Aug: "أغسطس",
  Sep: "سبتمبر",
  Oct: "أكتوبر",
  Nov: "نوفمبر",
  Dec: "ديسمبر",
};

function arabicUnitWord(quantity: number) {
  if (quantity === 2) return "وحدتين";
  if (quantity >= 3 && quantity <= 10) return "وحدات";
  return "وحدة";
}

export function translateCopy(value: string, language: Language, context?: { quantity?: number }): string {
  if (language === "en") return value;
  const trimmed = value.trim();
  const leading = value.slice(0, value.indexOf(trimmed));
  const trailing = value.slice(value.indexOf(trimmed) + trimmed.length);
  if (ARABIC_COPY[trimmed]) return `${leading}${ARABIC_COPY[trimmed]}${trailing}`;
  if (/^BHD\b/.test(trimmed)) return `${leading}${trimmed.replace(/^BHD\b/, "د.ب")}${trailing}`;
  if (/^Across the (.+)$/.test(trimmed)) {
    const detail = trimmed.match(/^Across the (.+)$/)?.[1] || "";
    const arabicDetail: Record<string, string> = {
      "last 7 days": "آخر 7 أيام",
      "last 30 days": "آخر 30 يومًا",
      "last 90 days": "آخر 90 يومًا",
      today: "اليوم",
      "all time": "كل الوقت",
      "custom period": "الفترة المخصصة",
      "selected period": "الفترة المحددة",
    };
    if (arabicDetail[detail]) return `${leading}خلال ${arabicDetail[detail]}${trailing}`;
  }
  if (/^Version (\d+)$/.test(trimmed)) return `${leading}الإصدار ${trimmed.match(/^Version (\d+)$/)?.[1] || ""}${trailing}`;
  if (/^(\d+) matching transactions?\. Every sale retains its source and invoice reference\.$/.test(trimmed)) {
    const quantity = Number(trimmed.match(/^(\d+) matching transactions?/)?.[1] || 0);
    return `${leading}${quantity === 0 ? "لا توجد معاملات مطابقة" : `${quantity} ${quantity === 1 ? "معاملة مطابقة" : "معاملات مطابقة"}`}. تحتفظ كل عملية بيع بمصدرها ومرجع فاتورتها.${trailing}`;
  }
  if (/^(\d+) items? in order$/.test(trimmed)) return `${leading}${trimmed.match(/^(\d+) items? in order$/)?.[1] || "0"} صنف في الطلب${trailing}`;
  if (trimmed === "items in order") {
    const quantity = context?.quantity ?? 0;
    return `${leading}${quantity} ${quantity === 1 ? "صنف" : "أصناف"} في الطلب${trailing}`;
  }
  if (/^(\d+) offline sales? waiting to sync$/.test(trimmed)) {
    const quantity = Number(trimmed.match(/^(\d+) offline sales?/)?.[1] || 0);
    return `${leading}${quantity} ${quantity === 1 ? "بيع دون اتصال" : "مبيعات دون اتصال"} بانتظار المزامنة${trailing}`;
  }
  if (/^(\d+) sales?$/.test(trimmed)) {
    const quantity = Number(trimmed.match(/^(\d+) sales?$/)?.[1] || 0);
    return `${leading}${quantity} ${quantity === 1 ? "بيع" : "مبيعات"}${trailing}`;
  }
  if (/^(\d+) units$/.test(trimmed)) {
    const quantity = Number(trimmed.match(/^(\d+) units$/)?.[1] || 0);
    return `${leading}${quantity} ${arabicUnitWord(quantity)}${trailing}`;
  }
  if (/^(\d+) records$/.test(trimmed)) {
    const quantity = Number(trimmed.match(/^(\d+) records$/)?.[1] || 0);
    return `${leading}${quantity} ${quantity === 1 ? "سجل" : "سجلات"}${trailing}`;
  }
  if (/^(\d+) units sold$/.test(trimmed)) {
    const quantity = Number(trimmed.match(/^(\d+) units sold$/)?.[1] || 0);
    return `${leading}تم بيع ${quantity} ${arabicUnitWord(quantity)}${trailing}`;
  }
  if (trimmed === "units sold") {
    const quantity = context?.quantity;
    return `${leading}${quantity ? `تم بيع ${quantity} ${arabicUnitWord(quantity)}` : "وحدات مباعة"}${trailing}`;
  }
  if (/^(\d+) open invoices? included in this balance\.$/.test(trimmed)) {
    const quantity = Number(trimmed.match(/^(\d+) open invoices? included in this balance\.$/)?.[1] || 0);
    return `${leading}يتضمن هذا الرصيد ${quantity} ${quantity === 1 ? "فاتورة مفتوحة" : "فواتير مفتوحة"}.${trailing}`;
  }
  if (/^Fitting version (\d+)$/.test(trimmed)) {
    return `${leading}إصدار القياس ${trimmed.match(/^Fitting version (\d+)$/)?.[1] || ""}${trailing}`;
  }
  if (/^Measurement (\d+) version$/.test(trimmed)) {
    return `${leading}القياس، الإصدار ${trimmed.match(/^Measurement (\d+) version$/)?.[1] || ""}${trailing}`;
  }
  if (/^Due (.+)$/.test(trimmed)) {
    return `${leading}التسليم ${trimmed.match(/^Due (.+)$/)?.[1] || ""}${trailing}`;
  }
  if (/^(\d+) pieces?$/.test(trimmed)) {
    const quantity = Number(trimmed.match(/^(\d+) pieces?$/)?.[1] || 0);
    return `${leading}${quantity} ${quantity === 1 ? "قطعة" : "قطع"}${trailing}`;
  }
  const widthMatch = trimmed.match(/^(\d+(?:\.\d+)?) in width$/);
  if (widthMatch) return `${leading}${widthMatch[1]} بوصة عرض${trailing}`;
  const perUnitMatch = trimmed.match(/^per (.+)$/);
  if (perUnitMatch) return `${leading}لكل ${perUnitMatch[1]}${trailing}`;
  const dateMatch = trimmed.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})(,?\s+\d{4})?(.*)$/);
  if (dateMatch) {
    const [, month, day, year = "", remainder = ""] = dateMatch;
    const localizedRemainder = remainder.replace(/\bAM\b/g, "ص").replace(/\bPM\b/g, "م");
    return `${leading}${day} ${ARABIC_MONTHS[month]}${year ? ` ${year.trim()}` : ""}${localizedRemainder}${trailing}`;
  }
  if (/^(.+) · threshold (.+)$/.test(trimmed)) {
    const [, code, threshold] = trimmed.match(/^(.+) · threshold (.+)$/) || [];
    return `${leading}${code} · الحد الأدنى ${threshold}${trailing}`;
  }
  if (/^Started (.+) · (.+)$/.test(trimmed)) {
    const [, time, detail] = trimmed.match(/^Started (.+) · (.+)$/) || [];
    return `${leading}بدأ ${time} · ${detail}${trailing}`;
  }
  if (/^Saved (\d+)$/.test(trimmed)) return `${leading}محفوظ $1${trailing}`.replace("$1", trimmed.match(/\d+/)?.[0] || "0");
  return value;
}

type LanguageContextValue = {
  language: Language;
  isArabic: boolean;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
  t: (value: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function translateDocument(language: Language) {
  const root = document.body;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) textNodes.push(node as Text);
  textNodes.forEach(textNode => {
    const parent = textNode.parentElement;
    if (!parent || parent.closest("[data-no-translate]") || ["SCRIPT", "STYLE", "NOSCRIPT"].includes(parent.tagName)) return;
    const current = textNode.nodeValue || "";
    const original = getTranslationSource(current, ORIGINAL_TEXT.get(textNode), LAST_TRANSLATED_TEXT.get(textNode));
    ORIGINAL_TEXT.set(textNode, original);
    const siblings = parent ? Array.from(parent.childNodes) : [];
    const siblingIndex = siblings.indexOf(textNode);
    const previousNode = siblingIndex > 0 && siblings[siblingIndex - 1]?.nodeType === Node.TEXT_NODE ? siblings[siblingIndex - 1] as Text : undefined;
    const previousOriginal = previousNode ? (ORIGINAL_TEXT.get(previousNode) || previousNode.nodeValue || "").trim() : "";
    const quantity = /^\d+(?:\.\d+)?$/.test(previousOriginal) ? Number(previousOriginal) : undefined;
    const splitCountSuffixes = new Set(["items in order", "units sold", "sales", "sale", "units"]);
    if (language === "ar" && quantity !== undefined && previousNode && splitCountSuffixes.has(original.trim())) previousNode.nodeValue = "";
    const translated = translateCopy(original, language, { quantity });
    textNode.nodeValue = translated;
    LAST_TRANSLATED_TEXT.set(textNode, translated);
  });
  document.querySelectorAll<HTMLElement>("input[placeholder], textarea[placeholder], [aria-label], [title]").forEach(element => {
    ["placeholder", "aria-label", "title"].forEach(attribute => {
      const current = element.getAttribute(attribute);
      if (!current) return;
      const originalKey = `data-original-${attribute}`;
      const original = element.getAttribute(originalKey) || current;
      element.setAttribute(originalKey, original);
      element.setAttribute(attribute, translateCopy(original, language));
    });
  });
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getStoredLanguage);
  const value = useMemo<LanguageContextValue>(() => ({
    language,
    isArabic: language === "ar",
    setLanguage: next => setLanguageState(next),
    toggleLanguage: () => setLanguageState(current => current === "ar" ? "en" : "ar"),
    t: value => translateCopy(value, language),
  }), [language]);

  useEffect(() => {
    try { window.localStorage?.setItem(STORAGE_KEY, language); } catch { /* Storage may be unavailable in restricted browsers. */ }
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    document.documentElement.classList.toggle("arabic-ui", language === "ar");
    let translating = false;
    let observer: MutationObserver;
    const apply = () => {
      if (translating) return;
      translating = true;
      observer?.disconnect();
      try {
        translateDocument(language);
      } finally {
        translating = false;
        observer?.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["placeholder", "aria-label", "title"] });
      }
    };
    observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["placeholder", "aria-label", "title"] });
    apply();
    return () => observer.disconnect();
  }, [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}

export type { Language };
