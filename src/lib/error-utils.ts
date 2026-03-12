/**
 * Maps Firebase/Firestore/Functions error codes to human-readable messages.
 */
export function getErrorMessage(err: unknown): string {
  if (!err) return "An unknown error occurred.";

  const message = err instanceof Error ? err.message : String(err);
  const code = (err as { code?: string })?.code;

  // Firebase Auth Errors
  if (code?.startsWith("auth/")) {
    switch (code) {
      case "auth/popup-blocked":
        return "Sign-in popup was blocked by your browser. Please allow popups and try again.";
      case "auth/popup-closed-by-user":
        return "Sign-in was cancelled.";
      case "auth/cancelled-popup-request":
        return "Sign-in request was cancelled.";
      case "auth/unauthorized-domain":
        return "This domain is not authorized for sign-in. Please check Firebase configuration.";
      case "auth/network-request-failed":
        return "Network error. Please check your connection.";
      case "auth/too-many-requests":
        return "Too many attempts. Please try again later.";
      case "auth/user-disabled":
        return "This account has been disabled.";
      default:
        return `Sign-in failed: ${message.slice(0, 100)}`;
    }
  }

  // Firestore Errors
  if (code && (code.includes("permission-denied") || code === "permission-denied")) {
    return "You don't have permission to perform this action.";
  }
  if (code === "unavailable") {
    return "The service is currently unavailable. You might be offline.";
  }

  // Functions Errors
  if (message.includes("not-found")) return "The requested resource was not found.";
  if (message.includes("already-exists")) return "This already exists.";
  
  // Generic network errors
  if (message.includes("offline") || message.includes("Failed to fetch") || message.includes("network")) {
    return "Network error. Please check your internet connection.";
  }

  return message.length > 120 ? `${message.slice(0, 120)}...` : message;
}
