// Matches the real `notifications` table exactly (see
// backend-v2/18_notification_system.sql).
export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  read_at: string | null;
  created_at: string;
}
