"use client";

import { useEffect, useState } from "react";
import {
  IconCheck,
  IconEye,
  IconEyeOff,
  IconLock,
  IconMail,
  IconUser,
  IconX,
} from "@tabler/icons-react";
import {
  loginSchema,
  passwordSchema,
  registerSchema,
} from "@moviex/shared-types";

import { cn } from "@/lib/utils";
import { AuthError, useLoginMutation, useSignupMutation } from "@/hooks/use-auth";
import { AUTH_COPY } from "@/lib/constants/errors";

type AuthMode = "login" | "register";

type FieldName = "name" | "email" | "password" | "confirmPassword";

type FormErrors = Partial<Record<FieldName, string>>;

const inputClass =
  "h-10 w-full rounded-[10px] border-[0.5px] border-mx-border bg-mx-field pl-9 pr-9 text-[13px] text-mx-fg placeholder:text-mx-fg-faint outline-none transition-colors focus:border-mx-accent aria-invalid:border-mx-accent";

const inputIconClass =
  "pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-mx-fg-faint";

const labelClass = "mb-1.5 block text-[13px] text-mx-fg-muted";

const linkClass =
  "text-mx-accent outline-none transition-colors hover:text-mx-accent-hover focus-visible:underline";

export type LoginRegisterModalProps = {
  isOpen: boolean;
  onClose: () => void;
  /** View the modal opens on. Defaults to login. */
  defaultMode?: AuthMode;
};

export function LoginRegisterModal({
  isOpen,
  onClose,
  defaultMode = "login",
}: LoginRegisterModalProps) {
  const [mode, setMode] = useState<AuthMode>(defaultMode);
  const [wasOpen, setWasOpen] = useState(isOpen);
  /*
   * Set only by the register -> login fallback (see `RegisterForm`), so the
   * user does not retype an address they just entered. Cleared on every
   * reopen along with the mode.
   */
  const [handoff, setHandoff] = useState<{ email: string; notice: string } | null>(
    null,
  );

  // Adjusting state during render (React's documented alternative to an effect):
  // every reopen starts from the parent's chosen view.
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setMode(defaultMode);
      // Closing clears the handoff too, so a later open never shows a stale
      // "Account created" notice.
      setHandoff(null);
    }
  }

  // The only side effect the modal needs: Esc to close + body scroll lock,
  // both tied to the same open/closed lifetime.
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isLogin = mode === "login";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-mx-backdrop p-4 font-mx"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        aria-describedby="auth-modal-description"
        // Clicks inside the panel must never reach the backdrop's close handler.
        onClick={(event) => event.stopPropagation()}
        className="animate-in fade-in zoom-in-95 my-auto w-full max-w-[352px] rounded-[14px] border-[0.5px] border-mx-border bg-mx-card p-5 duration-150"
      >
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-[8px] bg-mx-accent" aria-hidden="true" />
          <span className="text-[15px] font-medium text-mx-fg">
            Movie<span className="text-mx-accent">X</span>
          </span>
        </div>

        <h2
          id="auth-modal-title"
          className="mt-5 text-[18px] font-medium text-mx-fg"
        >
          {isLogin ? "Welcome back" : "Create an account"}
        </h2>
        <p id="auth-modal-description" className="mt-1 text-[13px] text-mx-fg-subtle">
          {isLogin
            ? "Sign in to pick up where you left off"
            : "Start building your movie collection"}
        </p>

        {/*
          Keying by mode remounts the form on every switch, so field values,
          errors and the mutation state reset themselves — no reset effect.
        */}
        {isLogin ? (
          <LoginForm
            key="login"
            initialEmail={handoff?.email ?? ""}
            notice={handoff?.notice ?? null}
            onSuccess={onClose}
            onSwitchMode={() => {
              setHandoff(null);
              setMode("register");
            }}
          />
        ) : (
          <RegisterForm
            key="register"
            onSuccess={onClose}
            onNeedsLogin={(email) => {
              setHandoff({ email, notice: AUTH_COPY.accountCreated });
              setMode("login");
            }}
            onSwitchMode={() => setMode("login")}
          />
        )}
      </div>
    </div>
  );
}

function LoginForm({
  initialEmail,
  notice,
  onSuccess,
  onSwitchMode,
}: {
  /** Pre-filled after a successful signup whose auto-login could not run. */
  initialEmail: string;
  notice: string | null;
  onSuccess: () => void;
  onSwitchMode: () => void;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const login = useLoginMutation();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const result = loginSchema.safeParse({ email, password, rememberMe });

    if (!result.success) {
      setErrors(toFieldErrors(result.error.issues));
      return;
    }

    setErrors({});
    // The cookie is set by the response; `useLoginMutation` invalidates
    // ['auth','me'] on success, so closing is all that is left to do here.
    login.mutate(result.data, { onSuccess });
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="mt-5" noValidate>
        <div className="mb-3.5">
          <label htmlFor="auth-email" className={labelClass}>
            Email
          </label>
          <div className="relative">
            <IconMail className={inputIconClass} stroke={1.75} />
            <input
              // Mounts with the modal, so the first field takes focus on open.
              autoFocus
              id="auth-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="najaf@example.com"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                clearError(setErrors, "email");
              }}
              aria-invalid={Boolean(errors.email)}
              className={inputClass}
            />
          </div>
          <FieldError message={errors.email} />
        </div>

        <div className="mb-3.5">
          <label htmlFor="auth-password" className={labelClass}>
            Password
          </label>
          <PasswordInput
            id="auth-password"
            name="password"
            autoComplete="current-password"
            value={password}
            onValueChange={(value) => {
              setPassword(value);
              clearError(setErrors, "password");
            }}
            visible={showPassword}
            onToggleVisible={() => setShowPassword((current) => !current)}
            invalid={Boolean(errors.password)}
          />
          <FieldError message={errors.password} />
        </div>

        <div className="mb-4 flex items-center justify-between">
          <label
            htmlFor="auth-remember"
            className="flex cursor-pointer items-center gap-2 text-[13px] text-mx-fg-muted"
          >
            <span className="relative flex size-4 items-center justify-center">
              <input
                id="auth-remember"
                name="rememberMe"
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
                className="peer size-4 cursor-pointer appearance-none rounded-[5px] border-[0.5px] border-mx-border bg-mx-field outline-none transition-colors checked:border-mx-accent checked:bg-mx-accent focus-visible:border-mx-accent"
              />
              <IconCheck
                className="pointer-events-none absolute size-3 text-mx-on-accent opacity-0 peer-checked:opacity-100"
                stroke={2.5}
              />
            </span>
            Remember me
          </label>

          <button type="button" className={cn("text-[13px]", linkClass)}>
            Forgot password?
          </button>
        </div>

        {/* Shown once, after a signup whose auto-login could not complete. */}
        {notice && !login.error && (
          <p role="status" className="mb-3 text-[12px] text-mx-success">
            {notice}
          </p>
        )}
        <FormError error={login.error} />

        <SubmitButton isPending={login.isPending}>
          {login.isPending ? AUTH_COPY.signingIn : "Sign in"}
        </SubmitButton>
      </form>

      <ModeSwitch
        prompt="Don't have an account?"
        action="Sign up"
        onSwitchMode={onSwitchMode}
      />
    </>
  );
}

function RegisterForm({
  onSuccess,
  onNeedsLogin,
  onSwitchMode,
}: {
  onSuccess: () => void;
  /** Auto-login failed — hand the email to the login view instead. */
  onNeedsLogin: (email: string) => void;
  onSwitchMode: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const signup = useSignupMutation();
  const login = useLoginMutation();

  /*
   * Option (b): sign the user straight in after creating the account, so they
   * never retype credentials they just chose. `/auth/signup` deliberately sets
   * no cookie, so this second call is what actually establishes the session.
   *
   * If that follow-up fails — rare, but a wrong-password race or a blip would
   * do it — fall back to option (a): switch to the login view with the email
   * pre-filled and an "Account created" notice, rather than leaving the user
   * with an account they appear not to have.
   */
  const isPending = signup.isPending || login.isPending;

  const strength = getPasswordStrength(password);
  const confirmMatches =
    confirmPassword.length > 0 && confirmPassword === password;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const result = registerSchema.safeParse({
      name,
      email,
      password,
      confirmPassword,
    });

    if (!result.success) {
      setErrors(toFieldErrors(result.error.issues));
      return;
    }

    setErrors({});

    signup.mutate(result.data, {
      onSuccess: () => {
        login.mutate(
          { email: result.data.email, password: result.data.password, rememberMe: false },
          {
            onSuccess,
            onError: () => onNeedsLogin(result.data.email),
          },
        );
      },
    });
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="mt-5" noValidate>
        <div className="mb-3.5">
          <label htmlFor="auth-name" className={labelClass}>
            Name
          </label>
          <div className="relative">
            <IconUser className={inputIconClass} stroke={1.75} />
            <input
              autoFocus
              id="auth-name"
              name="name"
              type="text"
              autoComplete="name"
              placeholder="Najaf"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                clearError(setErrors, "name");
              }}
              aria-invalid={Boolean(errors.name)}
              className={inputClass}
            />
          </div>
          <FieldError message={errors.name} />
        </div>

        <div className="mb-3.5">
          <label htmlFor="auth-email" className={labelClass}>
            Email
          </label>
          <div className="relative">
            <IconMail className={inputIconClass} stroke={1.75} />
            <input
              id="auth-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="najaf@example.com"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                clearError(setErrors, "email");
              }}
              aria-invalid={Boolean(errors.email)}
              className={inputClass}
            />
          </div>
          <FieldError message={errors.email} />
        </div>

        <div className="mb-3.5">
          <label htmlFor="auth-password" className={labelClass}>
            Password
          </label>
          <PasswordInput
            id="auth-password"
            name="password"
            autoComplete="new-password"
            value={password}
            onValueChange={(value) => {
              setPassword(value);
              clearError(setErrors, "password");
            }}
            visible={showPassword}
            onToggleVisible={() => setShowPassword((current) => !current)}
            invalid={Boolean(errors.password)}
          />
          <FieldError message={errors.password} />

          <div className="mt-2 flex items-center gap-2">
            <div className="flex flex-1 items-center gap-1.5">
              {[1, 2, 3].map((segment) => (
                <span
                  key={segment}
                  className="h-[3px] flex-1 rounded-full bg-mx-border transition-colors"
                  style={
                    strength.score >= segment
                      ? { backgroundColor: strength.color }
                      : undefined
                  }
                />
              ))}
            </div>
            <span className="w-10 shrink-0 text-right text-[12px] text-mx-fg-faint">
              {strength.label}
            </span>
          </div>
        </div>

        <div className="mb-4">
          <label htmlFor="auth-confirm-password" className={labelClass}>
            Confirm password
          </label>
          <div className="relative">
            <IconLock className={inputIconClass} stroke={1.75} />
            <input
              id="auth-confirm-password"
              name="confirmPassword"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(event) => {
                setConfirmPassword(event.target.value);
                clearError(setErrors, "confirmPassword");
              }}
              aria-invalid={Boolean(errors.confirmPassword)}
              className={inputClass}
            />
            {confirmPassword.length > 0 && (
              <span
                className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2"
                aria-hidden="true"
              >
                {confirmMatches ? (
                  <IconCheck className="size-4 text-mx-success" stroke={2} />
                ) : (
                  <IconX className="size-4 text-mx-accent" stroke={2} />
                )}
              </span>
            )}
          </div>
          <FieldError message={errors.confirmPassword} />
        </div>

        {/* Either half of the signup -> login chain can fail. */}
        <FormError error={signup.error ?? login.error} />

        <SubmitButton isPending={isPending}>
          {isPending ? AUTH_COPY.creatingAccount : "Create account"}
        </SubmitButton>

        <p className="mt-3 text-center text-[12px] text-mx-fg-faint">
          By continuing you agree to the terms
        </p>
      </form>

      <ModeSwitch
        prompt="Already have an account?"
        action="Daxil ol"
        onSwitchMode={onSwitchMode}
      />
    </>
  );
}

function PasswordInput({
  id,
  name,
  autoComplete,
  value,
  onValueChange,
  visible,
  onToggleVisible,
  invalid,
}: {
  id: string;
  name: string;
  autoComplete: "current-password" | "new-password";
  value: string;
  onValueChange: (value: string) => void;
  visible: boolean;
  onToggleVisible: () => void;
  invalid: boolean;
}) {
  return (
    <div className="relative">
      <IconLock className={inputIconClass} stroke={1.75} />
      <input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        placeholder="••••••••"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        aria-invalid={invalid}
        className={inputClass}
      />
      <button
        type="button"
        onClick={onToggleVisible}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-mx-fg-faint outline-none transition-colors hover:text-mx-fg-muted focus-visible:text-mx-fg-muted"
      >
        {visible ? (
          <IconEyeOff className="size-4" stroke={1.75} />
        ) : (
          <IconEye className="size-4" stroke={1.75} />
        )}
      </button>
    </div>
  );
}

function SubmitButton({
  isPending,
  children,
}: {
  isPending: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={isPending}
      className="h-10 w-full rounded-[10px] bg-mx-accent text-[14px] font-medium text-mx-on-accent outline-none transition-colors hover:bg-mx-accent-hover focus-visible:bg-mx-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  );
}

function ModeSwitch({
  prompt,
  action,
  onSwitchMode,
}: {
  prompt: string;
  action: string;
  onSwitchMode: () => void;
}) {
  return (
    <>
      <div className="my-4 flex items-center gap-3">
        <span className="h-px flex-1 bg-mx-border" />
        <span className="text-[12px] text-mx-fg-faint">or</span>
        <span className="h-px flex-1 bg-mx-border" />
      </div>

      <p className="text-center text-[13px] text-mx-fg-subtle">
        {prompt}{" "}
        <button type="button" onClick={onSwitchMode} className={linkClass}>
          {action}
        </button>
      </p>
    </>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;

  return (
    <p role="alert" className="mt-1.5 text-[12px] text-mx-accent">
      {message}
    </p>
  );
}

/**
 * Only `AuthError` messages are rendered — those are curated in `use-auth.ts`.
 * Anything else (a thrown TypeError, an upstream string) falls back to generic
 * copy, so raw error text and stack detail can never reach the UI.
 */
function FormError({ error }: { error: Error | null }) {
  if (!error) return null;

  const message =
    error instanceof AuthError && error.message
      ? error.message
      : AUTH_COPY.genericError;

  return (
    <p role="alert" className="mb-3 text-[12px] text-mx-accent">
      {message}
    </p>
  );
}

/** Strength is measured against the same `min(8)` zod rule the form validates with. */
function getPasswordStrength(password: string) {
  if (password.length === 0) {
    return { score: 0, label: "", color: "" };
  }

  if (!passwordSchema.safeParse(password).success) {
    return { score: 1, label: "Weak", color: "var(--mx-strength-weak)" };
  }

  const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((pattern) =>
    pattern.test(password),
  ).length;

  if (variety >= 3 || password.length >= 12) {
    return { score: 3, label: "Strong", color: "var(--mx-strength-strong)" };
  }

  return { score: 2, label: "Medium", color: "var(--mx-strength-medium)" };
}

function toFieldErrors(
  issues: readonly { path: PropertyKey[]; message: string }[],
) {
  const errors: FormErrors = {};

  for (const issue of issues) {
    const field = issue.path[0] as FieldName | undefined;
    if (field && !errors[field]) {
      errors[field] = issue.message;
    }
  }

  return errors;
}

function clearError(
  setErrors: React.Dispatch<React.SetStateAction<FormErrors>>,
  field: FieldName,
) {
  setErrors((current) =>
    current[field] ? { ...current, [field]: undefined } : current,
  );
}

export default LoginRegisterModal;
