import type { Language } from "./markets/types";

export const productFactsDate = "2026-11-17";
export const offlineAnswer = "Supported mobile workflows can use eligible, server-verified access while disconnected. Offline permission snapshots are valid for at most 24 hours after server verification. Access is refreshed on reconnect and queued work is authorised again by the server. A cached login alone does not grant offline project access.";

type ProductFacts = {
  title: string; description: string; summary: string; updated: string; contact: string;
  questions: readonly { id: string; question: string; answer: string }[];
};

export const productFacts: Record<Language, ProductFacts> = {
  en: {
    title: "BuildPanda product facts and answers",
    description: "What BuildPanda does, who it is for, Panda AI, permissions, offline access, pricing and payment recording. Clear answers for construction teams in Africa.",
    summary: "BuildPanda is construction management software for contractors and property owners across Africa, connecting estimates, project planning, site records, inspections, materials and payment records from enquiry to handover.",
    updated: "Updated", contact: "Ask the BuildPanda team",
    questions: [
      { id: "audience", question: "Who is BuildPanda for?", answer: "Contractors use the software to run their own construction projects. Owners and their authorised project teams can follow the records they have permission to view. The managed construction service is a separate offering; a country guide does not establish that this service is available in that location." },
      { id: "ai", question: "What does Panda AI do?", answer: "Panda AI assists with project information and drawing takeoffs. Generated quantities and proposed actions require human review. Access to project information and tools follows the caller’s organisation and project permissions; the assistant does not grant extra access." },
      { id: "money", question: "Does BuildPanda hold money or transfer payments?", answer: "No. BuildPanda records payment information, certificates and money movements that happen outside the platform. It is not a bank, payment processor or escrow provider, and does not hold or transfer funds." },
      { id: "offline", question: "Can site teams use BuildPanda offline?", answer: offlineAnswer },
      { id: "pricing", question: "How is BuildPanda priced?", answer: "There is no published price list. Software pricing is quoted per project and scales with contract value. Inspections are quoted per visit. Ask the team for a quote for your actual scope." },
      { id: "languages", question: "Which languages and countries do these guides cover?", answer: "The country directory covers Africa’s 54 UN member countries, with guides in English, French, Arabic and Portuguese. These are marketing and evaluation guides. Confirm product interface languages, currencies, tax handling, contract forms and local service availability during the demo." },
      { id: "imports", question: "Will our BOQ and planning files work?", answer: "Send the team a sample bill of quantities and planning export before committing. Confirm the file format, measurement standard and fields that can be imported or exported. A mention of a tool or document in a guide is not a promise of an automatic integration." },
    ],
  },
  fr: {
    title: "BuildPanda : informations produit et réponses",
    description: "Fonctions de BuildPanda, publics concernés, Panda AI, droits, accès hors connexion, tarifs et suivi des paiements pour les équipes de construction en Afrique.",
    summary: "BuildPanda est un logiciel de gestion de construction pour entreprises et propriétaires en Afrique. Il relie devis, planification, dossiers de chantier, inspections, matériaux et paiements enregistrés, du premier contact à la réception.",
    updated: "Mis à jour", contact: "Contacter l’équipe BuildPanda",
    questions: [
      { id: "audience", question: "À qui s’adresse BuildPanda ?", answer: "Les entreprises utilisent le logiciel pour gérer leurs propres chantiers. Les propriétaires et leurs équipes autorisées suivent les dossiers auxquels leurs droits donnent accès. Le service de gestion de construction est distinct ; un guide national ne prouve pas sa disponibilité locale." },
      { id: "ai", question: "Que fait Panda AI ?", answer: "Panda AI aide à consulter les informations du projet et à préparer des métrés à partir des plans. Les quantités produites et actions proposées nécessitent une vérification humaine. L’accès aux données et outils suit les permissions de l’organisation et du projet de l’utilisateur ; l’assistant n’accorde aucun droit supplémentaire." },
      { id: "money", question: "BuildPanda détient-il ou transfère-t-il des fonds ?", answer: "Non. BuildPanda enregistre les informations de paiement, certificats et mouvements financiers réalisés hors de la plateforme. Ce n’est ni une banque, ni un prestataire de paiement, ni un dépositaire de fonds ; il ne détient et ne transfère pas d’argent." },
      { id: "offline", question: "Les équipes peuvent-elles travailler hors connexion ?", answer: "Les fonctions mobiles prises en charge peuvent utiliser un accès éligible vérifié par le serveur. Les permissions hors connexion expirent au plus tard 24 heures après cette vérification. L’accès est actualisé à la reconnexion et les opérations en attente sont de nouveau autorisées par le serveur. Une connexion mémorisée seule ne donne aucun accès hors ligne au projet." },
      { id: "pricing", question: "Comment BuildPanda est-il facturé ?", answer: "Il n’existe pas de grille tarifaire publiée. Le logiciel fait l’objet d’un devis par projet, selon la valeur du contrat. Les inspections sont chiffrées par visite. Demandez un devis correspondant au périmètre réel de vos travaux." },
      { id: "languages", question: "Quels pays et langues les guides couvrent-ils ?", answer: "L’annuaire couvre les 54 pays africains membres de l’ONU, avec des guides en anglais, français, arabe et portugais. Ce sont des contenus de présentation et d’évaluation. Confirmez en démonstration les langues du produit, devises, taxes, modèles contractuels et services locaux disponibles." },
      { id: "imports", question: "Nos quantitatifs et fichiers de planification sont-ils compatibles ?", answer: "Envoyez un exemple de quantitatif et un export de planning avant de vous engager. Confirmez le format, la norme de mesure et les champs importables ou exportables. La mention d’un outil ou d’un document dans un guide ne garantit pas une intégration automatique." },
    ],
  },
  ar: {
    title: "حقائق المنتج وإجابات BuildPanda",
    description: "ما يقدمه BuildPanda ولمن صُمم، وPanda AI والصلاحيات والعمل دون اتصال والتسعير وتسجيل الدفعات لفرق البناء في أفريقيا.",
    summary: "BuildPanda برنامج لإدارة البناء للمقاولين وملاك العقارات في أفريقيا، يربط التقديرات وتخطيط المشاريع وسجلات الموقع والفحوصات والمواد وسجلات الدفعات من الاستفسار الأول إلى التسليم.",
    updated: "آخر تحديث", contact: "تواصل مع فريق BuildPanda",
    questions: [
      { id: "audience", question: "لمن صُمم BuildPanda؟", answer: "يستخدم المقاولون البرنامج لإدارة مشاريعهم. يستطيع الملاك وفرقهم المخولة متابعة السجلات المسموح لهم بالاطلاع عليها. خدمة إدارة تنفيذ البناء عرض مستقل؛ ولا يثبت وجود دليل بلد توفر تلك الخدمة محليًا." },
      { id: "ai", question: "ماذا يفعل Panda AI؟", answer: "يساعد Panda AI في معلومات المشروع وحصر الكميات من المخططات. تحتاج الكميات الناتجة والإجراءات المقترحة إلى مراجعة بشرية. يتبع الوصول إلى المعلومات والأدوات صلاحيات مؤسسة المستخدم ومشروعه؛ ولا يمنح المساعد وصولًا إضافيًا." },
      { id: "money", question: "هل يحتفظ BuildPanda بالأموال أو يحوّل الدفعات؟", answer: "لا. يسجّل BuildPanda معلومات الدفعات والشهادات والحركات المالية التي تحدث خارج المنصة. ليس بنكًا أو معالج دفعات أو مزود حساب ضمان، ولا يحتفظ بالأموال أو يحوّلها." },
      { id: "offline", question: "هل يستطيع فريق الموقع العمل دون اتصال؟", answer: "تستخدم وظائف الهاتف المدعومة وصولًا مؤهلًا تحقّق منه الخادم. تنتهي صلاحيات العمل دون اتصال خلال 24 ساعة كحد أقصى من التحقق. تُحدّث عند إعادة الاتصال وتُراجع صلاحية العمليات المنتظرة على الخادم مجددًا. تسجيل دخول مخزن وحده لا يمنح وصولًا للمشروع دون اتصال." },
      { id: "pricing", question: "كيف يُسعّر BuildPanda؟", answer: "لا توجد قائمة أسعار منشورة. يُقدّم عرض سعر للبرنامج لكل مشروع ويتناسب مع قيمة العقد. تُسعّر الفحوصات لكل زيارة. اطلب عرضًا يتوافق مع نطاق أعمالك الفعلي." },
      { id: "languages", question: "ما البلدان واللغات التي تغطيها الأدلة؟", answer: "يشمل الدليل البلدان الأفريقية الـ54 الأعضاء في الأمم المتحدة بأدلة إنجليزية وفرنسية وعربية وبرتغالية. هي أدلة تعريف وتقييم. تحقق في العرض من لغات واجهة المنتج والعملات والضرائب ونماذج العقود وتوفر الخدمات المحلية." },
      { id: "imports", question: "هل تتوافق ملفات الكميات والتخطيط لدينا؟", answer: "أرسل مثالًا لجدول الكميات وملف تخطيط مصدرًا قبل الالتزام. أكد الصيغة ومعيار القياس والحقول القابلة للاستيراد أو التصدير. ذكر أداة أو وثيقة في الدليل لا يضمن تكاملًا آليًا معها." },
    ],
  },
  pt: {
    title: "BuildPanda: factos do produto e respostas",
    description: "O que faz o BuildPanda, destinatários, Panda AI, permissões, acesso sem ligação, preços e registo de pagamentos para equipas de construção em África.",
    summary: "O BuildPanda é software de gestão de construção para empreiteiros e proprietários em África, ligando orçamentos, planeamento, registos de obra, inspeções, materiais e pagamentos registados, do primeiro contacto à entrega.",
    updated: "Atualizado", contact: "Contactar a equipa BuildPanda",
    questions: [
      { id: "audience", question: "A quem se destina o BuildPanda?", answer: "Os empreiteiros usam o software para gerir as próprias obras. Proprietários e equipas autorizadas acompanham os registos que têm permissão para consultar. O serviço de gestão da construção é uma oferta distinta; um guia de país não comprova a sua disponibilidade local." },
      { id: "ai", question: "O que faz o Panda AI?", answer: "O Panda AI ajuda com informações do projeto e medições a partir de desenhos. Quantidades geradas e ações propostas exigem revisão humana. O acesso a dados e ferramentas respeita as permissões da organização e do projeto do utilizador; o assistente não concede acesso adicional." },
      { id: "money", question: "O BuildPanda guarda dinheiro ou transfere pagamentos?", answer: "Não. O BuildPanda regista informações de pagamento, certificados e movimentos financeiros realizados fora da plataforma. Não é banco, processador de pagamentos nem prestador de contas de garantia e não guarda nem transfere fundos." },
      { id: "offline", question: "As equipas podem trabalhar sem ligação?", answer: "As funções móveis suportadas podem usar acesso elegível verificado pelo servidor. As permissões sem ligação são válidas até 24 horas após essa verificação. O acesso é atualizado na reconexão e as operações em espera são novamente autorizadas pelo servidor. Uma sessão guardada não concede, por si só, acesso ao projeto sem ligação." },
      { id: "pricing", question: "Como é definido o preço do BuildPanda?", answer: "Não existe tabela de preços publicada. O software é orçamentado por projeto e varia com o valor do contrato. As inspeções são orçamentadas por visita. Peça uma proposta para o âmbito real dos trabalhos." },
      { id: "languages", question: "Que países e línguas abrangem os guias?", answer: "O diretório abrange os 54 países africanos membros da ONU, com guias em inglês, francês, árabe e português. São conteúdos de apresentação e avaliação. Confirme na demonstração as línguas do produto, moedas, impostos, modelos contratuais e serviços locais disponíveis." },
      { id: "imports", question: "Os nossos ficheiros de quantidades e planeamento funcionam?", answer: "Envie um exemplo de mapa de quantidades e de exportação do planeamento antes de se comprometer. Confirme formato, norma de medição e campos importáveis ou exportáveis. A menção de uma ferramenta ou documento num guia não garante uma integração automática." },
    ],
  },
};

export function productFactsPath(language: Language): string {
  return language === "en" ? "product-facts" : `${language}/product-facts`;
}
