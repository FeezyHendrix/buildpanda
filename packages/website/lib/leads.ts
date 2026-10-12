/**
 * Consultation enquiries go to the backend's public lead endpoint
 * (POST /leads/consultation), which stores the lead and emails the team.
 * Overridable per environment. In development with no override there is no
 * endpoint and the form logs the enquiry instead of sending it.
 */
const endpoint =
  process.env.NEXT_PUBLIC_LEADS_ENDPOINT ||
  (process.env.NODE_ENV === "production" ? "https://api.buildpanda.io/leads/consultation" : undefined);

/** The endpoint's body. It rejects any other field. */
export type ConsultationLead = {
  name: string;
  email: string;
  phone: string;
  location: string;
  projectType: string;
  message?: string;
  source: string;
};

export async function sendConsultationLead(lead: ConsultationLead): Promise<void> {
  if (!endpoint) {
    console.info("Consultation enquiry (not sent: no endpoint in development)", lead);
    return;
  }
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(lead),
  });
  if (!response.ok) throw new Error(`Lead endpoint responded ${response.status}`);
}
