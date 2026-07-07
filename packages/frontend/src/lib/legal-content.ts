export interface LegalSection {
  heading: string;
  body: string[];
  bullets?: string[];
}

export interface LegalDocument {
  title: string;
  intro: string[];
  effectiveDate: string;
  sections: LegalSection[];
}

const COMPANY = "BuildPanda";
const SUPPORT_EMAIL = "hello@buildpanda.ai";
const EFFECTIVE_DATE = "14 June 2026";

export const privacyPolicy: LegalDocument = {
  title: "Privacy Policy",
  effectiveDate: EFFECTIVE_DATE,
  intro: [
    `${COMPANY} ("${COMPANY}", "we", "us" or "our") provides a construction management platform that helps owners, contractors and project teams plan, build and hand over construction projects. This Privacy Policy explains what personal information we collect, how we use and share it, and the choices and rights you have.`,
    `This policy applies to our websites, web and mobile applications, and related services (together, the "Services"). By using the Services you agree to the practices described here. If you do not agree, please do not use the Services.`,
  ],
  sections: [
    {
      heading: "1. Who we are and how to contact us",
      body: [
        `${COMPANY} is the controller of the personal information processed about you when you use the Services, except where we process information on behalf of our business customers (see "How we handle customer project data" below), in which case we act as a processor for that customer.`,
        `If you have any questions about this policy or how we handle your information, contact us at ${SUPPORT_EMAIL}.`,
      ],
    },
    {
      heading: "2. Information we collect",
      body: ["We collect the following categories of personal information:"],
      bullets: [
        "Account information: your name, email address, phone number, password, company or organisation, role, and profile details you provide when you register or are invited to a project.",
        "Project information: data you and your team enter into the platform, such as project details, schedules and activities, budgets and finances, milestone payments, documents and drawings, daily logs, inspections, risks, materials and messages.",
        "Uploaded content: files, documents, photos and drawings you upload, and any information contained within them.",
        "Usage information: how you interact with the Services, including pages viewed, features used, actions taken, and timestamps.",
        "Device and technical information: IP address, browser type, device identifiers, operating system, and similar diagnostic data collected automatically.",
        "Communications: messages, support requests and feedback you send to us.",
        "Lead and enquiry information: details you submit through our website forms, such as when you request a consultation or a demo.",
      ],
    },
    {
      heading: "3. How we use your information",
      body: ["We use personal information to:"],
      bullets: [
        "Provide, operate and maintain the Services and your account.",
        "Process and display your project data, documents and communications to authorised members of your project.",
        "Power platform features such as scheduling, finances, milestone payments, document management and inspections.",
        "Provide AI-assisted features (Panda AI) that analyse your project's own data and documents to answer your questions and surface insights, on your request.",
        "Communicate with you about your account, security, updates, and support.",
        "Send service and, where permitted, marketing communications, which you can opt out of.",
        "Monitor, secure, troubleshoot and improve the Services, and develop new features.",
        "Detect, prevent and respond to fraud, abuse, security incidents and unlawful activity.",
        "Comply with legal obligations and enforce our terms.",
      ],
    },
    {
      heading: "4. How we handle customer project data",
      body: [
        `When an organisation uses ${COMPANY} to run its projects, that organisation controls the project data it and its members put into the platform. For that data we act as a service provider (processor) and process it on the organisation's instructions to provide the Services.`,
        `If you are a member, client or participant of a project, the organisation that owns the project is responsible for how that project's data is used and shared within the project. Please direct requests about that data to the organisation. We will assist our customers in responding to such requests as required by law.`,
      ],
    },
    {
      heading: "5. AI features and your data",
      body: [
        `Some features use artificial intelligence to help you work, including extracting information from documents you upload, structuring imported schedules, and answering questions about your project. These features operate only on the data within your own project and only when you use them.`,
        `We may use third-party AI providers to process the content you submit to these features. We do not permit those providers to use your content to train their models, and we send only the data needed to perform the requested task. AI output can contain mistakes; you should verify important information.`,
      ],
    },
    {
      heading: "6. How we share information",
      body: ["We do not sell your personal information. We share information only as follows:"],
      bullets: [
        "Within your project: with other authorised members, clients and participants of the projects you belong to, according to their roles and permissions.",
        "Service providers: with vendors who help us run the Services (for example cloud hosting, file storage, email delivery, and AI processing), under contracts that require them to protect your information and use it only for us.",
        "Shared links: when you create a shareable link to a file, anyone with the link can view that file until it expires or you revoke it.",
        "Legal and safety: when required by law, regulation, legal process, or to protect the rights, property or safety of BuildPanda, our users or others.",
        "Business transfers: in connection with a merger, acquisition, financing or sale of assets, subject to this policy.",
        "With your consent: for any other purpose disclosed to you at the time.",
      ],
    },
    {
      heading: "7. International transfers",
      body: [
        `We and our service providers may process and store information in countries other than where you live. Where we transfer personal information across borders, we take steps to ensure it remains protected and that transfers comply with applicable data protection laws.`,
      ],
    },
    {
      heading: "8. Data retention",
      body: [
        `We keep personal information for as long as your account is active or as needed to provide the Services, and afterwards as required to comply with legal obligations, resolve disputes, and enforce our agreements. Project data is retained according to the controlling organisation's settings and instructions. When information is no longer needed, we delete or anonymise it.`,
      ],
    },
    {
      heading: "9. Security",
      body: [
        `We use technical and organisational measures designed to protect personal information, including encryption in transit, access controls, and secure infrastructure. Files are stored securely and shared links use unguessable tokens. No method of transmission or storage is completely secure, so we cannot guarantee absolute security, and you are responsible for keeping your account credentials safe.`,
      ],
    },
    {
      heading: "10. Your rights and choices",
      body: [
        "Depending on where you live, you may have rights to access, correct, update, delete, restrict, or object to the processing of your personal information, to data portability, and to withdraw consent. You may also opt out of marketing communications at any time.",
        `To exercise your rights, contact us at ${SUPPORT_EMAIL}. Where the data relates to a project controlled by an organisation, we may direct your request to that organisation. We will respond in accordance with applicable law and may need to verify your identity first.`,
      ],
    },
    {
      heading: "11. Cookies and similar technologies",
      body: [
        "We use cookies and similar technologies to keep you signed in, remember your preferences, secure the Services, and understand how the Services are used. You can control cookies through your browser settings, but disabling them may affect how the Services work.",
      ],
    },
    {
      heading: "12. Children's privacy",
      body: [
        "The Services are intended for business use and are not directed to children. We do not knowingly collect personal information from children. If you believe a child has provided us personal information, contact us and we will take appropriate steps to delete it.",
      ],
    },
    {
      heading: "13. Changes to this policy",
      body: [
        "We may update this Privacy Policy from time to time. When we make material changes, we will update the effective date above and, where appropriate, provide additional notice. Your continued use of the Services after changes take effect means you accept the updated policy.",
      ],
    },
    {
      heading: "14. Contact us",
      body: [
        `If you have questions, concerns or requests regarding this Privacy Policy or your personal information, please contact us at ${SUPPORT_EMAIL}.`,
      ],
    },
  ],
};

export const dataPolicy: LegalDocument = {
  title: "Data Policy",
  effectiveDate: EFFECTIVE_DATE,
  intro: [
    `This Data Policy explains how ${COMPANY} handles the data you and your organisation put into the platform to run construction projects. It complements our Privacy Policy, which covers personal information more broadly.`,
    `Our goal is simple: your project data belongs to you, we keep it secure, and we use it to deliver the Services you asked for.`,
  ],
  sections: [
    {
      heading: "1. Ownership of your data",
      body: [
        `You and your organisation own the project data you create and upload, including project records, schedules, finances, documents, drawings, daily logs, inspections and messages. ${COMPANY} does not claim ownership of your content.`,
        `We process this data on your behalf to operate the Services. We do not use your project content for advertising, and we do not sell it.`,
      ],
    },
    {
      heading: "2. What data the platform stores",
      body: ["To run your projects, the platform stores data such as:"],
      bullets: [
        "Project setup, phases, activities and the schedule, including dependencies, % complete and milestones.",
        "Finances, budgets, invoices and milestone payments.",
        "Documents, drawings and uploaded files, and their versions.",
        "Daily site logs, inspections, risks and materials.",
        "Team members, roles, permissions and project participants.",
        "Activity history needed to keep an accurate record of the project.",
      ],
    },
    {
      heading: "3. Who can see your data",
      body: [
        "Access to project data is controlled by roles and permissions you manage. Only authorised members, clients and participants of a project can see that project's data, and only to the extent their role allows.",
        "When you generate a shareable link to a file, anyone with that link can view the file until the link expires or you revoke it. You control whether and when to create or revoke share links.",
      ],
    },
    {
      heading: "4. How we use third parties",
      body: [
        "We rely on trusted infrastructure providers to host the application, store files, deliver email and, for AI features, process the specific content you submit. These providers act under contract on our instructions and are required to protect your data. We share only what is necessary to deliver the Services.",
      ],
    },
    {
      heading: "5. Data security",
      body: [
        "We protect your data with encryption in transit, access controls, secure cloud storage, and unguessable tokens for shared files. We continually work to safeguard the platform, though no system can be completely secure.",
      ],
    },
    {
      heading: "6. Backups and availability",
      body: [
        "We maintain backups and operational safeguards designed to keep your data available and to help recover from incidents. We aim to provide a reliable service but do not guarantee uninterrupted availability.",
      ],
    },
    {
      heading: "7. Exporting and deleting your data",
      body: [
        "You can access and export key project information from within the Services. If your organisation closes its account, we will delete or return project data in accordance with our agreement and applicable law, subject to any records we must retain for legal reasons.",
      ],
    },
    {
      heading: "8. Retention",
      body: [
        "We retain project data for as long as your account is active and as needed to provide the Services, then delete or anonymise it according to your instructions and our legal obligations.",
      ],
    },
    {
      heading: "9. Contact us",
      body: [
        `For questions about how your data is handled, or to make a data request, contact us at ${SUPPORT_EMAIL}.`,
      ],
    },
  ],
};

export const termsOfService: LegalDocument = {
  title: "Terms of Service",
  effectiveDate: EFFECTIVE_DATE,
  intro: [
    `These Terms of Service ("Terms") govern your access to and use of the ${COMPANY} construction management platform, including our websites, web and mobile applications and related services (together, the "Services"). They form a binding agreement between you and ${COMPANY} ("${COMPANY}", "we", "us" or "our").`,
    `By creating an account, accepting an invitation to a project, or otherwise using the Services, you agree to these Terms. If you are using the Services on behalf of an organisation, you confirm that you have authority to bind that organisation, and "you" refers to that organisation. If you do not agree, do not use the Services.`,
    `These Terms incorporate our Privacy Policy and Data Policy by reference. Our handling of personal data is described in those documents and is carried out in accordance with the Nigeria Data Protection Act 2023 (NDPA), the Nigeria Data Protection Regulation (NDPR), and, where it applies to you, the EU/UK General Data Protection Regulation (GDPR).`,
  ],
  sections: [
    {
      heading: "1. Who we are",
      body: [
        `${COMPANY} provides a construction management platform that helps owners, contractors and project teams plan, build and hand over construction projects. You can reach us at ${SUPPORT_EMAIL} for any questions about these Terms.`,
      ],
    },
    {
      heading: "2. Eligibility and accounts",
      body: [
        "The Services are intended for business and professional use by people aged 18 or over. By using the Services you confirm you meet this requirement.",
        "You are responsible for the information you provide when registering, for keeping your login credentials confidential, and for all activity that happens under your account. Notify us promptly at the contact address above if you suspect unauthorised access.",
      ],
    },
    {
      heading: "3. Your organisation, roles and invited users",
      body: [
        "Projects on the platform are organised around an owning organisation. Whoever creates or administers a project controls who may join it and what each participant can see and do, through roles and permissions.",
        "If you invite others to a project, you are responsible for ensuring you have the right to share the relevant data with them, and for managing their access. Invited users are also bound by these Terms when they use the Services.",
      ],
    },
    {
      heading: "4. Acceptable use",
      body: [
        "You agree to use the Services lawfully and only for legitimate construction and project-management purposes. You must not:",
      ],
      bullets: [
        "Break any applicable law or regulation, or infringe anyone else's rights, including intellectual property and data protection rights.",
        "Upload or share content that is unlawful, fraudulent, defamatory, or that you do not have the right to share.",
        "Attempt to gain unauthorised access to the Services, other accounts, or our systems, or interfere with their normal operation.",
        "Introduce malware, scrape the Services at scale, or reverse engineer the platform except to the extent the law expressly permits.",
        "Use the Services to send spam or to process personal data in ways that breach the NDPA, NDPR or GDPR.",
      ],
    },
    {
      heading: "5. Your content and data",
      body: [
        `You and your organisation retain ownership of the project data and content you create or upload, including project records, schedules, finances, documents, drawings, daily logs, inspections and messages. ${COMPANY} does not claim ownership of your content.`,
        `You grant us a limited licence to host, store, process and display your content solely to operate and improve the Services for you, and to comply with the law. We do not sell your project content and we do not use it for advertising. How we handle data is set out in our Data Policy and Privacy Policy.`,
        "You are responsible for ensuring you have a lawful basis to upload personal data about third parties (for example site workers or clients) and for honouring their data-protection rights.",
      ],
    },
    {
      heading: "6. Data protection (NDPA, NDPR and GDPR)",
      body: [
        `Where ${COMPANY} processes personal data that you put into the platform, we act as a data processor and you (or your organisation) act as the data controller. We process that data on your documented instructions and in accordance with the NDPA, the NDPR and, where applicable, the GDPR.`,
        "We maintain appropriate technical and organisational measures to protect personal data, restrict access through roles and permissions, and assist you, so far as reasonably possible, in meeting your own obligations — including responding to data-subject requests and reporting personal-data breaches.",
        "Where we determine the purposes and means of processing (for example, account and billing information), we act as a controller and process that data as described in our Privacy Policy. Cross-border transfers, where they occur, are carried out with safeguards required by applicable data-protection law.",
      ],
    },
    {
      heading: "7. Intellectual property",
      body: [
        `The Services, including the platform software, design, and ${COMPANY} trademarks, are owned by ${COMPANY} or our licensors and are protected by intellectual-property laws. These Terms do not transfer any ${COMPANY} intellectual property to you; we grant only the right to use the Services as described here.`,
      ],
    },
    {
      heading: "8. Fees",
      body: [
        "Some features of the Services may be offered on a paid basis. Where fees apply, they will be made clear to you before you incur them, and you agree to pay them in accordance with the plan or order you accept. Unless stated otherwise, fees are exclusive of applicable taxes.",
      ],
    },
    {
      heading: "9. Availability and changes to the Services",
      body: [
        "We work to keep the Services available and reliable, but we do not guarantee uninterrupted access. We may update, add to, or remove features over time, and we may carry out maintenance that temporarily affects availability.",
      ],
    },
    {
      heading: "10. Suspension and termination",
      body: [
        "You may stop using the Services at any time. We may suspend or terminate your access if you materially breach these Terms, if required by law, or to protect the Services or other users.",
        "On termination, your right to use the Services ends. We will handle any project data in line with our Data Policy and your lawful instructions, subject to retention obligations imposed by law.",
      ],
    },
    {
      heading: "11. Disclaimers",
      body: [
        `The Services support how you manage construction projects but do not replace professional engineering, legal, financial or safety judgement. To the fullest extent permitted by law, the Services are provided "as is" and "as available", and we disclaim implied warranties not expressly stated in these Terms.`,
      ],
    },
    {
      heading: "12. Limitation of liability",
      body: [
        `To the fullest extent permitted by applicable law, ${COMPANY} will not be liable for indirect, incidental, special or consequential losses, or for loss of profits, revenue or data, arising from your use of the Services. Nothing in these Terms excludes liability that cannot lawfully be excluded.`,
      ],
    },
    {
      heading: "13. Indemnity",
      body: [
        `You agree to indemnify and hold ${COMPANY} harmless from claims arising out of your unlawful use of the Services, your breach of these Terms, or your infringement of another party's rights, including data-protection and intellectual-property rights.`,
      ],
    },
    {
      heading: "14. Governing law",
      body: [
        "These Terms are governed by the laws of the Federal Republic of Nigeria, without regard to conflict-of-laws principles. Disputes will be subject to the jurisdiction of the competent courts of Nigeria, without affecting any mandatory data-protection rights you have under the NDPA, NDPR or GDPR.",
      ],
    },
    {
      heading: "15. Changes to these Terms",
      body: [
        "We may update these Terms from time to time. When we make material changes, we will update the effective date above and, where appropriate, provide additional notice. Your continued use of the Services after changes take effect means you accept the updated Terms.",
      ],
    },
    {
      heading: "16. Contact us",
      body: [
        `If you have questions about these Terms, contact us at ${SUPPORT_EMAIL}.`,
      ],
    },
  ],
};
