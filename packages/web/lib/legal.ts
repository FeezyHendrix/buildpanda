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

export const termsOfService: LegalDocument = {
  title: "Terms of Service",
  effectiveDate: EFFECTIVE_DATE,
  intro: [
    `These Terms of Service ("Terms") govern your access to and use of the websites, web applications, mobile applications and related services (together, the "Services") operated by ${COMPANY} ("${COMPANY}", "we", "us" or "our"). By creating an account, accepting an invitation, or otherwise using the Services you agree to be bound by these Terms. If you are using the Services on behalf of an organisation, you represent that you have authority to bind that organisation, and "you" refers to that organisation.`,
    `If you do not agree to these Terms, do not use the Services. Please also read our Privacy Policy and Data Policy, which are incorporated into these Terms by reference.`,
  ],
  sections: [
    {
      heading: "1. Definitions",
      body: [
        `"Account" means a registered user account on the Services. "Customer" means the organisation or individual that subscribes to the Services. "User" means any individual who accesses the Services under a Customer's Account. "Customer Data" means all data, files and content submitted by a Customer or its Users through the Services. "Subscription" means a paid or trial plan that grants access to the Services for a defined period.`,
      ],
    },
    {
      heading: "2. The Services",
      body: [
        `${COMPANY} provides a construction management platform that enables owners, contractors and project teams to manage construction projects from inception to handover. Features include project creation and scheduling, milestone and payment tracking, document management, site activity logs, inspections, BIM file handling, AI-assisted tools (Panda AI), and related functionality.`,
        `We reserve the right to modify, suspend or discontinue any feature or aspect of the Services at any time, with reasonable notice where practicable. We will not materially reduce the core functionality of a paid Subscription during its term without offering you a remedy.`,
      ],
    },
    {
      heading: "3. Account Registration",
      body: [
        `To access the Services you must create an Account or be invited by a Customer. You agree to provide accurate, current and complete information and to keep it updated. You are responsible for maintaining the confidentiality of your login credentials and for all activity that occurs under your Account.`,
        `You must notify us immediately at ${SUPPORT_EMAIL} if you suspect any unauthorised access to your Account. We are not liable for any loss arising from unauthorised use of your Account where you have not notified us promptly.`,
        `You must be at least 18 years old to use the Services. The Services are intended for business use and are not directed to consumers acting in a personal capacity.`,
      ],
    },
    {
      heading: "4. Acceptable Use",
      body: [
        "You agree to use the Services only for lawful purposes and in accordance with these Terms. You must not:",
      ],
      bullets: [
        "Use the Services to transmit unlawful, harmful, fraudulent, defamatory or infringing content.",
        "Attempt to gain unauthorised access to any part of the Services, other accounts, or related systems or networks.",
        "Reverse engineer, decompile or disassemble any part of the Services, or attempt to derive source code.",
        "Use automated tools to scrape, crawl or extract data from the Services without our prior written consent.",
        "Interfere with or disrupt the integrity or performance of the Services or the data contained within.",
        "Use the Services to build a competing product or to benchmark the Services for publication without our consent.",
        "Upload or transmit any malware, viruses, or other harmful code.",
        "Impersonate any person or entity or misrepresent your affiliation with any person or entity.",
      ],
    },
    {
      heading: "5. Subscriptions and Payment",
      body: [
        `Access to certain features of the Services requires a paid Subscription. Subscription fees, billing cycles and included features are set out on our pricing page or in your order form. All fees are stated exclusive of applicable taxes, which you are responsible for paying.`,
        `Subscriptions renew automatically at the end of each billing cycle unless you cancel before the renewal date. We will provide reasonable notice of any fee changes before they take effect. Continued use of the Services after a fee change constitutes your acceptance of the new fees.`,
        `We do not offer refunds for partially used billing periods except where required by applicable law or expressly stated otherwise in your order.`,
      ],
    },
    {
      heading: "6. Milestone Payments and Escrow",
      body: [
        `${COMPANY} provides tools to structure, track and manage construction milestone payments between project owners and contractors. These tools are facilitation features only. ${COMPANY} is not a bank, escrow agent, payment institution or financial services provider, and does not hold, transfer or guarantee funds on behalf of any party unless explicitly stated in a separate written agreement.`,
        `Where the platform records a milestone payment as "released" or "verified", this reflects the status recorded by users within the platform and does not constitute a legal release of funds or a guarantee of payment. Actual fund transfers occur through your chosen payment method outside the platform unless a third-party payment integration is explicitly enabled and disclosed.`,
        `Disputes between project owners and contractors regarding payment amounts, milestone completion or fund release are between those parties. ${COMPANY} may provide dispute-logging tools as a record-keeping aid but takes no responsibility for resolving financial disputes or for the outcome of any construction contract.`,
      ],
    },
    {
      heading: "7. Intellectual Property",
      body: [
        `${COMPANY} and its licensors own all right, title and interest in and to the Services, including all software, designs, trademarks, logos and documentation. These Terms do not grant you any ownership interest in the Services. You are granted a limited, non-exclusive, non-transferable, revocable licence to access and use the Services during your Subscription solely for your internal business purposes.`,
        `If you provide us with feedback, suggestions or ideas about the Services, you grant us a perpetual, irrevocable, royalty-free licence to use that feedback for any purpose without obligation to you.`,
      ],
    },
    {
      heading: "8. Your Content and Data",
      body: [
        `You retain all ownership rights in Customer Data. By uploading or submitting Customer Data to the Services, you grant ${COMPANY} a limited, worldwide licence to host, store, process, display and transmit that data solely to provide and improve the Services and as described in our Privacy Policy and Data Policy.`,
        `You are solely responsible for the accuracy, legality and appropriateness of Customer Data. You represent and warrant that you have all rights necessary to submit Customer Data to the Services and that doing so does not violate any third-party rights or applicable law.`,
        `We do not claim ownership of your Customer Data and will not use it for advertising or sell it to third parties.`,
      ],
    },
    {
      heading: "9. AI Features (Panda AI)",
      body: [
        `The Services include AI-assisted features ("Panda AI") that may analyse Customer Data — such as uploaded documents, schedules and project records — to help users extract information, answer questions, and surface insights. These features operate only on your own project data and only when you invoke them.`,
        `AI-generated output may contain errors, omissions or inaccuracies. You are responsible for reviewing and verifying any AI output before relying on it for decisions. ${COMPANY} does not warrant the accuracy, completeness or fitness for purpose of AI-generated content.`,
        `We may use third-party AI model providers to power these features. Those providers are contractually restricted from using your content to train their models. We submit only the minimum data required to complete the requested task.`,
      ],
    },
    {
      heading: "10. Confidentiality",
      body: [
        `Each party may have access to confidential information of the other in connection with the Services. Each party agrees to keep the other's confidential information confidential, to use it only for the purposes of these Terms, and to disclose it only to personnel who need it and are bound by equivalent obligations.`,
        `Confidential information does not include information that is or becomes publicly available through no fault of the receiving party, was already known to the receiving party, or is independently developed without reference to the disclosing party's confidential information.`,
      ],
    },
    {
      heading: "11. Third-party Services",
      body: [
        `The Services may integrate with or link to third-party services, platforms or content. We do not control and are not responsible for third-party services, and your use of them is governed by those parties' own terms and policies. We are not liable for any loss or damage arising from your use of third-party services.`,
      ],
    },
    {
      heading: "12. Disclaimers",
      body: [
        `THE SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTY OF ANY KIND. TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, ${COMPANY.toUpperCase()} DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE AND NON-INFRINGEMENT.`,
        `We do not warrant that the Services will be uninterrupted, error-free or free of harmful components, or that any defects will be corrected. Construction projects involve inherent risks and complexities; the Services are a management tool only and do not substitute for professional engineering, legal or financial advice.`,
      ],
    },
    {
      heading: "13. Limitation of Liability",
      body: [
        `TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, ${COMPANY.toUpperCase()} AND ITS OFFICERS, DIRECTORS, EMPLOYEES, AGENTS AND LICENSORS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, PUNITIVE OR EXEMPLARY DAMAGES, INCLUDING LOSS OF PROFITS, DATA, GOODWILL OR BUSINESS OPPORTUNITIES, ARISING OUT OF OR IN CONNECTION WITH THESE TERMS OR THE SERVICES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.`,
        `TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, OUR TOTAL AGGREGATE LIABILITY TO YOU ARISING OUT OF OR IN CONNECTION WITH THESE TERMS OR THE SERVICES SHALL NOT EXCEED THE GREATER OF (A) THE TOTAL FEES PAID BY YOU IN THE TWELVE MONTHS PRECEDING THE CLAIM OR (B) ONE HUNDRED US DOLLARS (USD 100).`,
        `Some jurisdictions do not allow the exclusion or limitation of certain warranties or liabilities, so the above limitations may not apply to you in full.`,
      ],
    },
    {
      heading: "14. Indemnification",
      body: [
        `You agree to indemnify, defend and hold harmless ${COMPANY} and its officers, directors, employees and agents from and against any claims, liabilities, damages, losses and expenses (including reasonable legal fees) arising out of or in connection with: (a) your use of the Services in violation of these Terms; (b) Customer Data you submit to the Services; (c) your violation of any applicable law or third-party rights; or (d) any dispute between you and another user or a third party.`,
      ],
    },
    {
      heading: "15. Term and Termination",
      body: [
        `These Terms apply from the date you first access the Services and continue until your Account and all Subscriptions are terminated. You may terminate your Account at any time by contacting us. We may suspend or terminate your access if you breach these Terms, fail to pay fees when due, or if required by law, with or without notice depending on the severity of the breach.`,
        `On termination, your right to access the Services ceases immediately. We will make Customer Data available for export for a reasonable period after termination, after which we may delete it in accordance with our Data Policy. Sections that by their nature should survive termination will survive, including sections on intellectual property, indemnification, disclaimers, limitation of liability and governing law.`,
      ],
    },
    {
      heading: "16. Governing Law and Disputes",
      body: [
        `These Terms are governed by and construed in accordance with the laws of the Federal Republic of Nigeria, without regard to its conflict of law principles. Any dispute arising out of or in connection with these Terms that cannot be resolved informally shall be submitted to the exclusive jurisdiction of the courts of Lagos State, Nigeria.`,
        `Before initiating any legal proceedings, you agree to contact us at ${SUPPORT_EMAIL} to attempt to resolve the dispute in good faith for a period of at least thirty (30) days.`,
      ],
    },
    {
      heading: "17. Changes to these Terms",
      body: [
        `We may update these Terms from time to time. When we make material changes, we will update the effective date above and notify you by email or through a notice within the Services. Your continued use of the Services after the updated Terms take effect constitutes your acceptance. If you do not agree to the updated Terms, you must stop using the Services and may terminate your Account.`,
      ],
    },
    {
      heading: "18. General",
      body: [
        `These Terms, together with our Privacy Policy, Data Policy and any applicable order form, constitute the entire agreement between you and ${COMPANY} with respect to the Services and supersede all prior agreements and understandings.`,
        `If any provision of these Terms is found to be unenforceable, that provision will be modified to the minimum extent necessary to make it enforceable, and the remaining provisions will continue in full force. Our failure to enforce any right or provision of these Terms is not a waiver of that right or provision.`,
        `You may not assign or transfer your rights or obligations under these Terms without our prior written consent. We may assign these Terms in connection with a merger, acquisition or sale of assets without your consent.`,
      ],
    },
    {
      heading: "19. Contact us",
      body: [
        `If you have any questions about these Terms or the Services, please contact us at ${SUPPORT_EMAIL}.`,
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
