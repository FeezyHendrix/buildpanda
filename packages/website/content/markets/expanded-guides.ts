import type { Market } from "./countries";
import { marketProfiles } from "./profiles";
import type { Language, MarketGuide } from "./types";

const copy = {
  en: {
    description: "Compare construction software with a local document reference, a practical site trial and checks for records, approvals and access.",
    example: "A practical project trial", records: "Keep the agreement and the evidence connected",
    recordsBody: "Start with the issued scope and drawing revision. Keep a dated instruction for each change, identify who may review it and connect measured progress to its inspection. Test the same record as a site worker, reviewer and owner; access must follow their granted permissions.",
    bring: "Bring the issued works package, its current drawing, one proposed change and the records used to measure and accept the work. Ask the team to retrieve the full decision trail and export a report you can reconcile with the source documents.",
  },
  fr: {
    description: "Comparez les logiciels de chantier avec une référence locale, un essai concret et des contrôles des pièces, validations et accès.",
    example: "Un essai concret sur un projet", records: "Relier l’accord aux preuves d’exécution",
    recordsBody: "Partez du périmètre émis et de la révision du plan. Datez chaque instruction de modification, identifiez le réviseur autorisé et reliez l’avancement mesuré à son inspection. Testez le même dossier comme agent de chantier, réviseur et propriétaire ; chaque accès doit suivre les droits accordés.",
    bring: "Apportez le dossier émis, le plan actuel, une modification proposée et les pièces de mesure et de réception. Demandez à l’équipe de retrouver les décisions et d’exporter un rapport rapprochable des documents sources.",
  },
  ar: {
    description: "قارن برامج البناء بمرجع وثائقي محلي وتجربة موقع عملية وفحوص للسجلات والاعتمادات وصلاحيات الوصول.",
    example: "اختبار عملي على مشروع", records: "ربط الاتفاق بأدلة التنفيذ",
    recordsBody: "ابدأ بالنطاق الصادر وإصدار المخطط. احفظ تعليمات مؤرخة لكل تغيير وحدد المراجع المخول واربط التقدم المقاس بفحصه. اختبر السجل نفسه كعامل موقع ومراجع ومالك؛ يجب أن يتبع الوصول الصلاحيات الممنوحة لكل منهم.",
    bring: "أحضر حزمة الأعمال الصادرة والمخطط الحالي وتغييرًا مقترحًا وسجلات قياس الأعمال وقبولها. اطلب من الفريق استرجاع مسار القرارات كاملًا وتصدير تقرير يمكن مطابقته مع الوثائق الأصلية.",
  },
  pt: {
    description: "Compare software de obras com uma referência local, um ensaio prático e verificações de documentos, aprovações e acesso.",
    example: "Um ensaio prático de projeto", records: "Ligar o acordo às provas de execução",
    recordsBody: "Comece pelo âmbito emitido e pela revisão do desenho. Date cada instrução de alteração, identifique o revisor autorizado e associe o progresso medido à inspeção. Teste o mesmo registo como trabalhador, revisor e proprietário; o acesso deve respeitar as permissões atribuídas.",
    bring: "Traga o dossier emitido, o desenho atual, uma alteração proposta e os registos de medição e receção. Peça à equipa para recuperar as decisões e exportar um relatório que possa conciliar com os documentos originais.",
  },
};

export function expandedGuides(language: Language, markets: readonly Market[]): Record<string, MarketGuide> {
  return Object.fromEntries(marketProfiles.map((profile) => {
    const market = markets.find((entry) => entry.code === profile.code);
    if (!market) throw new Error(`Unknown guide country: ${profile.code}`);
    const name = language === "en" ? market.name : new Intl.DisplayNames([language], { type: "region" }).of(market.code);
    const text = profile.content[language];
    const labels = copy[language];
    return [profile.code, {
      description: `${name}: ${labels.description}`,
      intro: text.context,
      sections: [{ heading: labels.example, body: text.pilot }, { heading: labels.records, body: labels.recordsBody }],
      pilot: labels.bring,
    }];
  }));
}
