import api from "./client";

export interface DataCommitmentStatus {
  version: string;
  accepted: boolean;
  acceptedAt: string | null;
  acceptedByName: string | null;
}

export const dataCommitmentApi = {
  status: () => api.get<DataCommitmentStatus>("/data-commitment").then((r) => r.data),
  accept: () => api.post<DataCommitmentStatus>("/data-commitment/accept").then((r) => r.data),
};
