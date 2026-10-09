export interface PublishedProjectUpdate {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  author: string;
  createdAt: Date;
  activityId: string | null;
  stageId: string | null;
}
