import type { Language } from "./markets/types";

export const consentCopy: Record<Language, {
  title: string; body: string; privacy: string; data: string; terms: string;
  law: string; essential: string; analytics: string; settings: string;
}> = {
  en: {
    title: "Cookies and data",
    body: "We use cookies that are needed to run the site, and, only if you agree, analytics that tell us which pages people read. You can change your mind at any time from the footer. See our",
    privacy: "Privacy Policy", data: "Data Policy", terms: "Terms",
    law: "We handle personal data under the Nigeria Data Protection Regulation and, where it applies to you, the UK and EU GDPR.",
    essential: "Essential only", analytics: "Accept analytics", settings: "Cookie settings",
  },
  fr: {
    title: "Cookies et données",
    body: "Nous utilisons les cookies nécessaires au site et, uniquement avec votre accord, des outils d’analyse des pages consultées. Vous pouvez modifier votre choix dans le pied de page. Consultez nos documents en anglais :",
    privacy: "Confidentialité", data: "Politique de données", terms: "Conditions",
    law: "Nous traitons les données personnelles selon le règlement nigérian de protection des données et, lorsqu’ils vous sont applicables, les RGPD britannique et européen.",
    essential: "Nécessaires uniquement", analytics: "Accepter les analyses", settings: "Réglages des cookies",
  },
  ar: {
    title: "ملفات الارتباط والبيانات",
    body: "نستخدم ملفات الارتباط اللازمة لتشغيل الموقع، وأدوات تحليل الصفحات فقط بموافقتك. يمكنك تغيير اختيارك من تذييل الصفحة في أي وقت. راجع وثائقنا بالإنجليزية:",
    privacy: "سياسة الخصوصية", data: "سياسة البيانات", terms: "الشروط",
    law: "نعالج البيانات الشخصية وفق لائحة حماية البيانات النيجيرية، ولائحتي حماية البيانات البريطانية والأوروبية حيث تنطبقان عليك.",
    essential: "الضرورية فقط", analytics: "قبول التحليلات", settings: "إعدادات ملفات الارتباط",
  },
  pt: {
    title: "Cookies e dados",
    body: "Usamos cookies necessários ao funcionamento do site e, apenas com o seu acordo, análises das páginas consultadas. Pode alterar a escolha no rodapé a qualquer momento. Consulte os nossos documentos em inglês:",
    privacy: "Privacidade", data: "Política de dados", terms: "Termos",
    law: "Tratamos os dados pessoais segundo o regulamento nigeriano de proteção de dados e, quando aplicáveis, os RGPD do Reino Unido e da União Europeia.",
    essential: "Apenas necessários", analytics: "Aceitar análises", settings: "Definições de cookies",
  },
};
