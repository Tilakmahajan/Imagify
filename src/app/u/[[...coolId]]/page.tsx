/** Required for static export - generates base /u path. Use /u?user=username format for share links. */
export function generateStaticParams() {
  return [{ coolId: undefined }];
}

import UserFeedbackClient from "./UserFeedbackClient";

export default function UserFeedbackPage() {
  return <UserFeedbackClient />;
}
