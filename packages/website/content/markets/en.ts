import type { MarketGuides } from "./types";

export const en: MarketGuides = {
  NG: {
    description: "Choosing construction management software in Nigeria: test BOQs, revised rates, site evidence and payment records on one real project.",
    intro: "Choose software by following one Nigerian project from the priced bill of quantities to handover. A contractor, quantity surveyor and remote owner need a shared record, with different rights to view costs, report work and approve changes.",
    sections: [
      { heading: "Keep the tender baseline when prices change", body: "Start with your own BOQ, supplier quotation dates and agreed contract rates. Test a revised quotation without overwriting the accepted estimate. For public procurement, consult the BPP’s revised standard bidding documents and keep the actual contract as the authority for your project workflow." },
      { heading: "Connect site evidence to the owner’s report", body: "Use a sample Lagos building project to follow a material delivery into stock, a daily log and an inspection. Then ask the owner to review progress without access to confidential contractor rates. A photo should identify the work and date; a payment record should identify what was certified." },
    ],
    pilot: "Bring one drawing, ten BOQ lines, a revised material quote and a sample payment certificate. Ask the team to trace a variation back to its approval, and test a site entry offline before reconnecting.",
  },
  GH: {
    description: "Compare construction software in Ghana using tender documents, measured work, deliveries and a practical project handover test.",
    intro: "For a Ghanaian contractor, a useful software trial begins with the documents the team already uses. Keep the tender scope, measured quantities and site records connected so a revised instruction does not become an unexplained budget difference.",
    sections: [
      { heading: "Match the record to the works package", body: "Ghana’s PPA publishes different standard documents for works procurement. Where a public tender applies, start with the document issued for that job. Test whether the software can keep that scope, the accepted BOQ and later instructions distinguishable, rather than treating every uploaded document as the current agreement." },
      { heading: "Reconcile deliveries before certifying work", body: "On a sample Accra project, record an order, a partial delivery and the balance still expected. Ask the site manager and QS to reconcile the same quantities. Keep delivered material separate from measured completed work, so a supplier receipt does not become evidence that a construction activity is finished." },
    ],
    pilot: "Use a works package, a delivery note with a shortage and an interim valuation. Follow the shortage to resolution, then check that the client can review the valuation without gaining permission to change it.",
  },
  KE: {
    description: "Construction software in Kenya: evaluate project documents, drawing revisions, subcontractor records and inspection follow-up.",
    intro: "A Kenyan project needs more than a task board. Evaluate how the system keeps approved drawings, the project team’s documents and the work reported on site together, while preserving who issued each revision and who accepted the work.",
    sections: [
      { heading: "Prepare a traceable project document pack", body: "The NCA project registration checklist references drawings, professional and contractor records, a BOQ summary and project agreements. Use the current official checklist to plan your document pack. Software should help organise evidence; storing a file is different from obtaining registration or an approval from the authority." },
      { heading: "Keep inspections tied to the drawing revision", body: "For a sample Nairobi apartment project, issue a revised structural drawing after an inspection has been recorded. Check that the old inspection still points to the inspected revision, and that the site team can identify the new instruction. An unresolved defect should retain its owner and follow-up record." },
    ],
    pilot: "Bring an approved drawing, its replacement and one inspection with a defect. Ask the inspector and subcontractor to close the issue with evidence while keeping the original decision and revision visible.",
  },
  ZA: {
    description: "Evaluate construction management software in South Africa against subcontract packages, certificates and a retrievable project track record.",
    intro: "Construction software for a South African team should make both today’s site decisions and the completed project record easy to retrieve. Test the trail from the awarded package to completion, rather than judging the system only by its dashboard.",
    sections: [
      { heading: "Retain evidence for the contractor’s track record", body: "The cidb grading guidance identifies award, completion and payment documents among the supporting records it considers. Use that guidance to plan your archive, then test retrieving a completed project’s evidence. The system’s document store does not itself establish a grading or verify a contractor’s registration." },
      { heading: "Separate subcontract progress from payment status", body: "On a sample Johannesburg refurbishment, measure a subcontract package, record a defect and prepare a progress valuation. Check that the outstanding defect, certified amount and recorded payment remain distinct. The contract determines how those records affect payment; a dashboard percentage should not make that decision." },
    ],
    pilot: "Bring a subcontract award, a progress certificate and a completion record. Retrieve them as a single project trail, then test whether the subcontractor can see its own work without seeing another package’s commercial information.",
  },
  MA: {
    description: "Construction software in Morocco: test tender records, multilingual source documents, drawing instructions and site reporting.",
    intro: "When evaluating software for a Moroccan project, follow the original tender and project documents through the site workflow. Agree the team’s working language and document naming before the trial, especially when the owner and delivery team use different languages.",
    sections: [
      { heading: "Keep procurement submissions separate from project records", body: "Morocco’s public procurement portal publishes its own user guidance. Where that portal applies, retain the issued tender documents and submission evidence alongside the project record. A construction management workspace supports the delivery trail; it should not be mistaken for the official procurement submission system." },
      { heading: "Test the team’s actual documents", body: "Use a sample Casablanca fit-out with French or Arabic source documents, a revised finish specification and a site inspection. Check document readability, identifiers and export output in the demo. A translated marketing page does not establish that every product screen, export or contract template is available in that language." },
    ],
    pilot: "Bring a source-language specification, a revised drawing and a contractor instruction. Have the site team identify the current version and return an inspection report that the owner can read without losing the original references.",
  },
  CM: {
    description: "Compare construction software in Cameroon with tender references, work lots, supplier evidence and bilingual document checks.",
    intro: "For a Cameroonian construction team, start the software evaluation with one clearly defined lot of work. Keep the tender reference, site instructions and measured progress together so that a report can be traced to the package it describes.",
    sections: [
      { heading: "Preserve the public procurement reference", body: "The ARMP publishes public procurement notices and related information. For a public works project, keep the relevant notice and issued documents with the contract record. Check that later instructions retain the original lot reference; a notice, an award and an instruction are separate records with different meanings." },
      { heading: "Reconcile reports across the delivery team", body: "Use a sample Douala site package with English and French source documents. Ask the supervisor to match a supplier delivery, a daily report and a measured quantity to the same lot. Test names, units and exports using those documents before deciding whether the product fits the team’s language requirements." },
    ],
    pilot: "Bring a lot description, a delivery note and a revised instruction. Produce one progress report with its supporting evidence, then check that the reviewer can approve only the records assigned to them.",
  },
};
