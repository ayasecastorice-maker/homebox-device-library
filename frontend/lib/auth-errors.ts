export function authErrorKey(action: "login" | "register", status?: number): string {
  if (!status) return "index.toast.connection_failed";
  if (status === 429) return "index.toast.too_many_attempts";
  if (status >= 500) return "index.toast.service_unavailable";
  if (action === "login") {
    if (status === 401) return "index.toast.invalid_email_password";
    if (status === 403) return "index.toast.local_login_disabled";
    return "index.toast.login_failed";
  }
  if (status === 409) return "index.toast.email_registered";
  if (status === 403) return "index.toast.registration_disabled";
  return "index.toast.problem_registering";
}
