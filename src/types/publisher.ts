export interface PublisherRow {
  id: string;
  github_handle: string;
  email: string | null;
  verified: boolean;
  created_at: string;
}

export interface Publisher {
  github_handle: string;
  verified: boolean;
}
