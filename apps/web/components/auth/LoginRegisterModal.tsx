"use client";

import { useEffect, useImperativeHandle, useRef, useState } from "react";
import { useTranslations } from "next-intl";
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
  NAME_MAX_LENGTH,
  NAME_MIN_LENGTH,
  OTP_CODE_LENGTH,
  PASSWORD_MIN_LENGTH,
  forgotPasswordSchema,
  loginSchema,
  passwordSchema,
  registerSchema,
  resetPasswordFormSchema,
} from "@moviex/shared-types";
import type {
  OtpChallenge,
  PasswordResetChallenge,
} from "@moviex/shared-types";

import { cn } from "@/lib/utils";
import {
  AuthError,
  isChallenge,
  useForgotPasswordMutation,
  useLoginMutation,
  useResendOtpMutation,
  useResetPasswordMutation,
  useSignupMutation,
  useVerifyOtpMutation,
  useVerifyResetOtpMutation,
} from "@/hooks/use-auth";

/**
 * The five screens this modal is.
 *
 * `otp` finishes a signup; `forgot` and `reset` are the password-recovery pair.
 * They are views of one component rather than separate modals because every one
 * of them can hand off to another — a login can turn out to need verification,
 * a reset ends back at login with the address pre-filled — and that handoff is
 * just a `setMode` when they share a parent.
 */
type AuthMode = "login" | "register" | "otp" | "forgot" | "reset";

/** The two halves of the `reset` view: enter the code, then choose a password. */
type ResetStage = "code" | "password";

/**
 * What the OTP view is counting down to, as absolute timestamps.
 *
 * Deadlines rather than durations: a `setInterval` that decrements a number
 * drifts, and stops entirely when the tab is backgrounded — so a user who
 * switches away for two minutes would come back to a clock that still claims
 * nine minutes left. Recomputing from a fixed target on every tick is immune to
 * both.
 *
 * `null` means "unknown", which is a real state: the login → verify path can
 * arrive without a challenge if the server declined to re-send. An unknown
 * expiry renders nothing rather than a made-up number.
 */
type OtpDeadlines = {
  expiresAt: number | null;
  resendAt: number | null;
  /**
   * `null` means **not disclosed**, which only the password-reset flow produces:
   * `POST /auth/forgot-password` answers identically whether or not it sent
   * anything, so reporting delivery there would leak the account's existence.
   * Distinct from `false`, which is a positive statement that a send failed.
   */
  emailSent: boolean | null;
};

function toDeadlines(challenge: OtpChallenge): OtpDeadlines {
  const now = Date.now();

  return {
    expiresAt: now + challenge.expiresInSeconds * 1000,
    resendAt: now + challenge.resendAvailableInSeconds * 1000,
    emailSent: challenge.emailSent,
  };
}

/**
 * Same shape from the reset challenge, whose figures are policy windows rather
 * than this account's remaining time — see `PasswordResetChallenge`. The clock
 * is therefore conservative, never wrong in the direction that matters: it can
 * only ever claim *more* time remains than a resend would actually need.
 */
function toResetDeadlines(challenge: PasswordResetChallenge): OtpDeadlines {
  const now = Date.now();

  return {
    expiresAt: now + challenge.expiresInSeconds * 1000,
    resendAt: now + challenge.resendAvailableInSeconds * 1000,
    emailSent: null,
  };
}

/** Four empty boxes. The array is the source of truth, not the joined string —
 *  a user can fill box 3 before box 1, and joining would silently lose that. */
function emptyDigits(): string[] {
  return Array.from({ length: OTP_CODE_LENGTH }, () => "");
}

/**
 * The zod schemas in `@moviex/shared-types` carry message **keys**, not
 * English, so both apps can share one set of rules while the wording lives in
 * the message files. This is the one place that turns a key back into text.
 *
 * Every length the messages might interpolate is passed on every call — `t`
 * ignores parameters a message does not use, so there is no per-key table to
 * keep in step with the schema.
 */
/** Length at which a password earns a point beyond the required minimum. */
const STRONG_PASSWORD_LENGTH = 12;

const VALIDATION_VALUES: Record<string, Record<string, number>> = {
  nameTooShort: { min: NAME_MIN_LENGTH },
  nameTooLong: { max: NAME_MAX_LENGTH },
  passwordTooShort: { min: PASSWORD_MIN_LENGTH },
};

/** `nameTooShort` → "Name must be at least 4 characters", in the active locale. */
function useValidationMessage() {
  const t = useTranslations("auth.validation");
  return (key: string) => t(key, VALIDATION_VALUES[key]);
}

type FieldName =
  | "name"
  | "email"
  | "password"
  | "newPassword"
  | "confirmPassword";

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
  const t = useTranslations("auth");
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
  /*
   * The account waiting on a code. `deadlines` is null on the login → verify
   * path, where the OTP view asks for a fresh code itself on mount.
   */
  const [pending, setPending] = useState<{
    email: string;
    deadlines: OtpDeadlines | null;
  } | null>(null);
  /*
   * The password-reset flow's own pair. Separate from `pending` on purpose: the
   * two flows use the same codes and the same screens, and sharing one slot is
   * how a half-finished signup verification would end up rendering as a reset.
   * `null` until `forgot` produces a challenge.
   */
  const [recovery, setRecovery] = useState<{
    email: string;
    deadlines: OtpDeadlines;
  } | null>(null);
  /** Seeds the `forgot` view, so an address typed on the login form carries. */
  const [forgotEmail, setForgotEmail] = useState("");
  // Lives here only so the heading can follow it; the reset token does not.
  const [resetStage, setResetStage] = useState<ResetStage>("code");

  // Adjusting state during render (React's documented alternative to an effect):
  // every reopen starts from the parent's chosen view.
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setMode(defaultMode);
      // Closing clears the handoff too, so a later open never shows a stale
      // "Account created" notice.
      setHandoff(null);
      // An abandoned verification does not survive a reopen: the code may well
      // have expired, and resuming against a dead clock is worse than
      // restarting.
      setPending(null);
      /*
       * The same for an abandoned reset — and here it is not only about a stale
       * clock. Dropping `recovery` unmounts `ResetPasswordForm`, which is what
       * discards the reset token with it. Closing the modal must not leave a
       * live credential sitting in memory for the next person to open it.
       */
      setRecovery(null);
      setForgotEmail("");
      setResetStage("code");
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

  const isOtp = mode === "otp" && pending !== null;
  const isReset = mode === "reset" && recovery !== null;
  const isForgot = mode === "forgot";
  const isRegister = mode === "register";

  /** Register and login both arrive at the OTP view; only the payload differs. */
  const startVerification = (email: string, challenge?: OtpChallenge) => {
    setHandoff(null);
    setPending({
      email,
      deadlines: challenge ? toDeadlines(challenge) : null,
    });
    setMode("otp");
  };

  /** Back to a clean login form, optionally with something to say. */
  const returnToLogin = (next?: { email: string; notice: string }) => {
    setPending(null);
    setRecovery(null);
    setResetStage("code");
    setHandoff(next ?? null);
    setMode("login");
  };

  const heading = isOtp
    ? {
        title: t("verifyEmailTitle"),
        // The address is echoed back so a typo is caught here rather than after
        // ten minutes of waiting for an email that went somewhere else.
        subtitle: t("verifyEmailSubtitle", { email: pending.email }),
      }
    : isReset
      ? {
          title: t("resetPasswordTitle"),
          subtitle:
            resetStage === "code"
              ? t("resetCodeSubtitle", { email: recovery.email })
              : t("resetPasswordSubtitle", { email: recovery.email }),
        }
      : isForgot
        ? {
            title: t("forgotPasswordTitle"),
            subtitle: t("forgotPasswordSubtitle"),
          }
        : isRegister
          ? {
              title: t("createAccountTitle"),
              subtitle: t("createAccountSubtitle"),
            }
          : { title: t("welcomeBack"), subtitle: t("welcomeBackSubtitle") };

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
          {heading.title}
        </h2>
        <p id="auth-modal-description" className="mt-1 text-[13px] text-mx-fg-subtle">
          {heading.subtitle}
        </p>

        {/*
          Keying by mode remounts the form on every switch, so field values,
          errors and the mutation state reset themselves — no reset effect.
        */}
        {isOtp ? (
          <OtpForm
            key="otp"
            email={pending.email}
            initialDeadlines={pending.deadlines}
            onSuccess={onClose}
            onAlreadyVerified={(email) =>
              returnToLogin({ email, notice: t("alreadyVerified") })
            }
            onBack={() => returnToLogin()}
          />
        ) : isReset ? (
          <ResetPasswordForm
            key="reset"
            email={recovery.email}
            initialDeadlines={recovery.deadlines}
            onStageChange={setResetStage}
            onPasswordUpdated={(email) =>
              /*
               * Straight back to login with the address filled in and a line
               * saying what happened. No session was created — signing in with
               * the new password is the last step, and it is also the only
               * thing that confirms it is the password they think it is.
               */
              returnToLogin({ email, notice: t("passwordUpdated") })
            }
            onBackToLogin={() => returnToLogin()}
          />
        ) : isForgot ? (
          <ForgotPasswordForm
            key="forgot"
            initialEmail={forgotEmail}
            onCodeRequested={(email, challenge) => {
              setRecovery({ email, deadlines: toResetDeadlines(challenge) });
              setResetStage("code");
              setMode("reset");
            }}
            onBackToLogin={() => returnToLogin()}
          />
        ) : isRegister ? (
          <RegisterForm
            key="register"
            onRegistered={startVerification}
            onSwitchMode={() => setMode("login")}
          />
        ) : (
          <LoginForm
            key="login"
            initialEmail={handoff?.email ?? ""}
            notice={handoff?.notice ?? null}
            onSuccess={onClose}
            onNeedsVerification={startVerification}
            onForgotPassword={(email) => {
              // Carry whatever they had already typed, so the next screen is
              // usually just "press send".
              setForgotEmail(email);
              setHandoff(null);
              setMode("forgot");
            }}
            onSwitchMode={() => {
              setHandoff(null);
              setMode("register");
            }}
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
  onNeedsVerification,
  onForgotPassword,
  onSwitchMode,
}: {
  /** Pre-filled when the user was handed back here from another view. */
  initialEmail: string;
  notice: string | null;
  onSuccess: () => void;
  /** Correct password, unverified address — finish signing up instead. */
  onNeedsVerification: (email: string) => void;
  /** Receives whatever is currently in the email field, typed or not. */
  onForgotPassword: (email: string) => void;
  onSwitchMode: () => void;
}) {
  const t = useTranslations("auth");
  const translateValidation = useValidationMessage();
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
      setErrors(toFieldErrors(result.error.issues, translateValidation));
      return;
    }

    setErrors({});
    // The cookie is set by the response; `useLoginMutation` invalidates
    // ['auth','me'] on success, so closing is all that is left to do here.
    login.mutate(result.data, {
      onSuccess,
      onError: (error) => {
        /*
         * An unverified address is not a dead end. The credentials were right,
         * so send the user to the OTP view rather than showing an error they
         * cannot act on — `OtpForm` asks for a fresh code on arrival.
         */
        if (
          error instanceof AuthError &&
          error.code === "EMAIL_NOT_VERIFIED"
        ) {
          onNeedsVerification(result.data.email);
        }
      },
    });
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="mt-5" noValidate>
        <div className="mb-3.5">
          <label htmlFor="auth-email" className={labelClass}>
            {t("emailLabel")}
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
            {t("passwordLabel")}
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
            {t("rememberMe")}
          </label>

          <button
            type="button"
            onClick={() => onForgotPassword(email)}
            className={cn("text-[13px]", linkClass)}
          >
            {t("forgotPassword")}
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
          {login.isPending ? t("signingIn") : t("signIn")}
        </SubmitButton>
      </form>

      <ModeSwitch
        prompt={t("noAccount")}
        action={t("signUp")}
        onSwitchMode={onSwitchMode}
      />
    </>
  );
}

function RegisterForm({
  onRegistered,
  onSwitchMode,
}: {
  /** Account created — move to the OTP view with the challenge it returned. */
  onRegistered: (email: string, challenge: OtpChallenge) => void;
  onSwitchMode: () => void;
}) {
  const t = useTranslations("auth");
  const translateValidation = useValidationMessage();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const signup = useSignupMutation();

  /*
   * Registering no longer signs anyone in. It used to chain straight into
   * `/auth/login`, which the verification gate makes wrong on purpose: an
   * unverified account must not get a session, and the API now refuses to give
   * it one. The code emailed here is what completes the signup.
   */
  const isPending = signup.isPending;

  const strength = getPasswordStrength(password, t);
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
      setErrors(toFieldErrors(result.error.issues, translateValidation));
      return;
    }

    setErrors({});

    signup.mutate(result.data, {
      onSuccess: (response) =>
        onRegistered(result.data.email, response.challenge),
    });
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="mt-5" noValidate>
        <div className="mb-3.5">
          <label htmlFor="auth-name" className={labelClass}>
            {t("nameLabel")}
          </label>
          <div className="relative">
            <IconUser className={inputIconClass} stroke={1.75} />
            <input
              autoFocus
              id="auth-name"
              name="name"
              type="text"
              autoComplete="name"
              placeholder={t("namePlaceholder")}
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
            {t("emailLabel")}
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
            {t("passwordLabel")}
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
            {t("confirmPasswordLabel")}
          </label>
          <div className="relative">
            <IconLock className={inputIconClass} stroke={1.75} />
            <input
              id="auth-confirm-password"
              name="confirmPassword"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder={t("passwordPlaceholder")}
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

        <FormError error={signup.error} />

        <SubmitButton isPending={isPending}>
          {isPending ? t("creatingAccount") : t("createAccount")}
        </SubmitButton>

        <p className="mt-3 text-center text-[12px] text-mx-fg-faint">
          {t("termsNotice")}
        </p>
      </form>

      <ModeSwitch
        prompt={t("haveAccount")}
        action={t("signIn")}
        onSwitchMode={onSwitchMode}
      />
    </>
  );
}

/**
 * The verification step: four digits, an expiry clock and a rate-limited
 * resend.
 *
 * This is the view that actually signs a new user in — `/auth/verify-otp` sets
 * the same cookie a password login does — so its success path is `onSuccess`
 * and nothing else, exactly like `LoginForm`.
 */
function OtpForm({
  email,
  initialDeadlines,
  onSuccess,
  onAlreadyVerified,
  onBack,
}: {
  email: string;
  /** `null` when arriving from a login: no code was issued on that request. */
  initialDeadlines: OtpDeadlines | null;
  onSuccess: () => void;
  onAlreadyVerified: (email: string) => void;
  onBack: () => void;
}) {
  const t = useTranslations("auth");
  const [digits, setDigits] = useState<string[]>(emptyDigits);
  const [deadlines, setDeadlines] = useState<OtpDeadlines | null>(
    initialDeadlines,
  );
  const [resent, setResent] = useState(false);
  const inputsRef = useRef<OtpCodeInputHandle>(null);
  /*
   * The last code sent to the server. Guards the auto-submit below: without it,
   * a rejected code re-submits itself on every render while it is still four
   * digits long, burning the five-attempt budget in one go.
   */
  const submittedRef = useRef<string | null>(null);

  const verify = useVerifyOtpMutation();
  const resend = useResendOtpMutation();

  const code = digits.join("");
  const isComplete = code.length === OTP_CODE_LENGTH;

  const expirySeconds = useSecondsRemaining(deadlines?.expiresAt ?? null);
  const resendSeconds = useSecondsRemaining(deadlines?.resendAt ?? null);

  const isLocked =
    verify.error instanceof AuthError &&
    verify.error.code === "OTP_TOO_MANY_ATTEMPTS";
  // Only once a challenge is known: an unknown expiry is not an expired one.
  const isExpired = deadlines?.expiresAt != null && expirySeconds === 0;
  const canSubmit = isComplete && !verify.isPending && !isLocked && !isExpired;

  const requestCode = () => {
    setResent(false);

    resend.mutate(
      { email },
      {
        onSuccess: (result) => {
          if (!isChallenge(result)) {
            // Verified in another tab, or the account was already done. There
            // is nothing to enter here any more.
            onAlreadyVerified(email);
            return;
          }

          setDeadlines(toDeadlines(result.challenge));
          setDigits(emptyDigits());
          // A new code means a new attempt budget server-side; drop the stale
          // rejection so the inputs come back to life.
          verify.reset();
          submittedRef.current = null;
          setResent(true);
          inputsRef.current?.focusFirst();
        },
        onError: (error) => {
          /*
           * A cooldown is not really a failure — a code is already outstanding.
           * Seed the countdown from the server's own figure so the button
           * unlocks at the right moment rather than at a guessed one.
           */
          if (
            error instanceof AuthError &&
            error.code === "OTP_RESEND_COOLDOWN" &&
            error.retryAfterSeconds !== undefined
          ) {
            const retryAt = Date.now() + error.retryAfterSeconds * 1000;
            setDeadlines((current) =>
              current
                ? { ...current, resendAt: retryAt }
                : { expiresAt: null, resendAt: retryAt, emailSent: true },
            );

            /*
             * Drop the error rather than render it. The countdown on the button
             * already says everything a cooldown means, and on the login → verify
             * path the user did not press anything — being told off for a request
             * this component made on their behalf is just noise.
             */
            resend.reset();
          }
        },
      },
    );
  };

  const submit = (value: string) => {
    submittedRef.current = value;
    verify.mutate({ email, code: value }, { onSuccess });
  };

  /*
   * Arriving from a login: the address is unverified but no code was issued by
   * that request, so ask for one. Runs once — `email` is fixed for this mount.
   */
  const requestedRef = useRef(false);
  useEffect(() => {
    if (initialDeadlines !== null || requestedRef.current) return;

    requestedRef.current = true;
    requestCode();
    // `requestCode` is recreated each render; the ref above is what bounds this
    // to a single call, so it is deliberately not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDeadlines]);

  /*
   * Auto-submit on the fourth digit. Four boxes set the expectation that
   * filling them is the action, and the guards make it safe: never while a
   * request is in flight, never against a code already tried, never once the
   * code is dead.
   */
  useEffect(() => {
    if (!canSubmit || submittedRef.current === code) return;

    submit(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, canSubmit]);

  const canResend = resendSeconds === 0 && !resend.isPending;

  return (
    <>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (canSubmit && submittedRef.current !== code) submit(code);
        }}
        className="mt-5"
        noValidate
      >
        <OtpCodeInput
          ref={inputsRef}
          digits={digits}
          onDigitsChange={setDigits}
          disabled={isLocked}
          invalid={Boolean(verify.error)}
        />

        <OtpStatusRow
          isExpired={isExpired}
          hasExpiry={deadlines?.expiresAt != null}
          expirySeconds={expirySeconds}
          resendSeconds={resendSeconds}
          isResending={resend.isPending}
          canResend={canResend}
          onResend={requestCode}
        />

        {/*
          A send that never left the building. The user is not waiting on a slow
          email, they are waiting on one that does not exist, and the only thing
          that helps is Resend.
        */}
        {deadlines?.emailSent === false && (
          <p role="alert" className="mb-3 text-[12px] text-mx-accent">
            {t("otpNotSent")}
          </p>
        )}

        {resent && !resend.error && !verify.error && (
          <p role="status" className="mb-3 text-[12px] text-mx-success">
            {t("otpResent")}
          </p>
        )}

        <FormError error={verify.error ?? resend.error} />

        <SubmitButton isPending={verify.isPending} disabled={!canSubmit}>
          {verify.isPending ? t("otpVerifying") : t("otpVerify")}
        </SubmitButton>
      </form>

      <ModeSwitch
        prompt={t("otpWrongEmail")}
        action={t("otpBackToLogin")}
        onSwitchMode={onBack}
      />
    </>
  );
}

/**
 * Step 1 of a reset: which address.
 *
 * **The confirmation is deliberately non-committal**, and this is the one place
 * the UI has to actively cooperate with the backend rather than just render it.
 * `POST /auth/forgot-password` answers identically for an address with an
 * account, one without, and one whose account is unverified — so this screen
 * says "if an account exists…" and moves on for all three. Saying "check your
 * inbox" would re-open, client-side, exactly the enumeration the endpoint is
 * built to close.
 */
function ForgotPasswordForm({
  initialEmail,
  onCodeRequested,
  onBackToLogin,
}: {
  /** Carried over from whatever the user had already typed on the login form. */
  initialEmail: string;
  onCodeRequested: (email: string, challenge: PasswordResetChallenge) => void;
  onBackToLogin: () => void;
}) {
  const t = useTranslations("auth");
  const translateValidation = useValidationMessage();
  const [email, setEmail] = useState(initialEmail);
  const [errors, setErrors] = useState<FormErrors>({});

  const forgotPassword = useForgotPasswordMutation();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const result = forgotPasswordSchema.safeParse({ email });

    if (!result.success) {
      setErrors(toFieldErrors(result.error.issues, translateValidation));
      return;
    }

    setErrors({});

    forgotPassword.mutate(result.data, {
      onSuccess: (response) =>
        onCodeRequested(result.data.email, response.challenge),
    });
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="mt-5" noValidate>
        <div className="mb-4">
          <label htmlFor="auth-email" className={labelClass}>
            {t("emailLabel")}
          </label>
          <div className="relative">
            <IconMail className={inputIconClass} stroke={1.75} />
            <input
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

        <FormError error={forgotPassword.error} />

        <SubmitButton isPending={forgotPassword.isPending}>
          {forgotPassword.isPending
            ? t("forgotPasswordSending")
            : t("forgotPasswordSubmit")}
        </SubmitButton>
      </form>

      <ModeSwitch
        prompt={t("rememberedPassword")}
        action={t("signIn")}
        onSwitchMode={onBackToLogin}
      />
    </>
  );
}

/**
 * Steps 2 and 3: the code, then the new password.
 *
 * One component for both because of the token between them. `verify-reset-otp`
 * hands back a short-lived credential that step 3 spends, and it must live
 * **only** in this component's state — never `localStorage`, `sessionStorage`,
 * a cookie or the URL. Unmounting the modal is what disposes of it, which is
 * only true while the two steps share a mount.
 *
 * The stage is reported upward (`onStageChange`) purely so the modal's heading
 * can follow; the token itself never leaves.
 */
function ResetPasswordForm({
  email,
  initialDeadlines,
  onStageChange,
  onPasswordUpdated,
  onBackToLogin,
}: {
  email: string;
  initialDeadlines: OtpDeadlines;
  onStageChange: (stage: ResetStage) => void;
  /** Password changed — back to login, pre-filled, with a confirmation. */
  onPasswordUpdated: (email: string) => void;
  onBackToLogin: () => void;
}) {
  const t = useTranslations("auth");
  const translateValidation = useValidationMessage();

  const [stage, setStage] = useState<ResetStage>("code");
  const [digits, setDigits] = useState<string[]>(emptyDigits);
  const [deadlines, setDeadlines] = useState<OtpDeadlines>(initialDeadlines);
  const [resent, setResent] = useState(false);
  /*
   * The one-time credential from step 2. State, not a ref, because the password
   * stage's submit depends on it — and nothing more durable than state, so it
   * cannot outlive the flow that minted it.
   */
  const [resetToken, setResetToken] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const inputsRef = useRef<OtpCodeInputHandle>(null);
  // Same guard as `OtpForm`: without it a rejected code re-submits itself on
  // every render while it is still four digits long, burning all five attempts.
  const submittedRef = useRef<string | null>(null);

  const verify = useVerifyResetOtpMutation();
  // Resending a reset code is the same request as asking for the first one —
  // there is no separate endpoint, and there should not be: a second one would
  // need its own identical non-disclosure rules.
  const resend = useForgotPasswordMutation();
  const reset = useResetPasswordMutation();

  const code = digits.join("");
  const isComplete = code.length === OTP_CODE_LENGTH;

  const expirySeconds = useSecondsRemaining(deadlines.expiresAt);
  const resendSeconds = useSecondsRemaining(deadlines.resendAt);

  const isLocked =
    verify.error instanceof AuthError &&
    verify.error.code === "OTP_TOO_MANY_ATTEMPTS";
  const isExpired = deadlines.expiresAt != null && expirySeconds === 0;
  const canSubmitCode =
    isComplete && !verify.isPending && !isLocked && !isExpired;
  const canResend = resendSeconds === 0 && !resend.isPending;

  const goToStage = (next: ResetStage) => {
    setStage(next);
    onStageChange(next);
  };

  const requestCode = () => {
    setResent(false);

    resend.mutate(
      { email },
      {
        onSuccess: (response) => {
          setDeadlines(toResetDeadlines(response.challenge));
          setDigits(emptyDigits());
          // A new code means a new attempt budget server-side; drop the stale
          // rejection so the boxes come back to life.
          verify.reset();
          submittedRef.current = null;
          setResent(true);
          inputsRef.current?.focusFirst();
        },
      },
    );
  };

  const submitCode = (value: string) => {
    submittedRef.current = value;

    verify.mutate(
      { email, code: value },
      {
        onSuccess: (response) => {
          setResetToken(response.resetToken);
          setResent(false);
          goToStage("password");
        },
      },
    );
  };

  /*
   * Auto-submit on the fourth digit, exactly as the verification screen does —
   * four boxes set the expectation that filling them *is* the action.
   */
  useEffect(() => {
    if (stage !== "code" || !canSubmitCode || submittedRef.current === code) {
      return;
    }

    submitCode(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, canSubmitCode, stage]);

  const handlePasswordSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const result = resetPasswordFormSchema.safeParse({
      newPassword,
      confirmPassword,
    });

    if (!result.success) {
      setErrors(toFieldErrors(result.error.issues, translateValidation));
      return;
    }

    // Should be unreachable — the password stage is only entered with a token.
    if (!resetToken) return;

    setErrors({});

    reset.mutate(
      { resetToken, newPassword: result.data.newPassword },
      {
        onSuccess: () => onPasswordUpdated(email),
        onError: (error) => {
          /*
           * The ten-minute token ran out while they were choosing. The message
           * says "request a new code", so put them where that button is rather
           * than leaving them on a form whose submit can no longer succeed.
           * The dead token goes with them.
           */
          if (
            error instanceof AuthError &&
            error.code === "RESET_TOKEN_INVALID"
          ) {
            setResetToken(null);
            setDigits(emptyDigits());
            submittedRef.current = null;
            verify.reset();
            goToStage("code");
          }
        },
      },
    );
  };

  if (stage === "code") {
    return (
      <>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (canSubmitCode && submittedRef.current !== code) submitCode(code);
          }}
          className="mt-5"
          noValidate
        >
          <OtpCodeInput
            ref={inputsRef}
            digits={digits}
            onDigitsChange={setDigits}
            disabled={isLocked}
            invalid={Boolean(verify.error)}
          />

          <OtpStatusRow
            isExpired={isExpired}
            hasExpiry={deadlines.expiresAt != null}
            expirySeconds={expirySeconds}
            resendSeconds={resendSeconds}
            isResending={resend.isPending}
            canResend={canResend}
            onResend={requestCode}
          />

          {/*
            No "we couldn't send that email" line on this flow: forgot-password
            never reports delivery, because doing so would confirm the account
            exists. `emailSent` is null here, not false — see `OtpDeadlines`.
          */}
          {resent && !resend.error && !verify.error && (
            <p role="status" className="mb-3 text-[12px] text-mx-success">
              {t("otpResent")}
            </p>
          )}

          {/*
            The token expiring mid-form lands here rather than on the password
            stage, having sent the user back — so its message is shown too.
          */}
          <FormError error={verify.error ?? resend.error ?? reset.error} />

          <SubmitButton isPending={verify.isPending} disabled={!canSubmitCode}>
            {verify.isPending ? t("otpVerifying") : t("otpVerify")}
          </SubmitButton>
        </form>

        <ModeSwitch
          prompt={t("otpWrongEmail")}
          action={t("otpBackToLogin")}
          onSwitchMode={onBackToLogin}
        />
      </>
    );
  }

  const strength = getPasswordStrength(newPassword, t);
  const confirmMatches =
    confirmPassword.length > 0 && confirmPassword === newPassword;

  return (
    <>
      <form onSubmit={handlePasswordSubmit} className="mt-5" noValidate>
        <div className="mb-3.5">
          <label htmlFor="auth-new-password" className={labelClass}>
            {t("newPasswordLabel")}
          </label>
          <PasswordInput
            id="auth-new-password"
            name="newPassword"
            autoComplete="new-password"
            value={newPassword}
            onValueChange={(value) => {
              setNewPassword(value);
              clearError(setErrors, "newPassword");
            }}
            visible={showPassword}
            onToggleVisible={() => setShowPassword((current) => !current)}
            invalid={Boolean(errors.newPassword)}
          />
          <FieldError message={errors.newPassword} />

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
          <label htmlFor="auth-confirm-new-password" className={labelClass}>
            {t("confirmNewPasswordLabel")}
          </label>
          <div className="relative">
            <IconLock className={inputIconClass} stroke={1.75} />
            <input
              id="auth-confirm-new-password"
              name="confirmPassword"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder={t("passwordPlaceholder")}
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

        <FormError error={reset.error} />

        <SubmitButton isPending={reset.isPending}>
          {reset.isPending
            ? t("resetPasswordSubmitting")
            : t("resetPasswordSubmit")}
        </SubmitButton>
      </form>

      <ModeSwitch
        prompt={t("rememberedPassword")}
        action={t("signIn")}
        onSwitchMode={onBackToLogin}
      />
    </>
  );
}

type OtpCodeInputHandle = {
  /** Puts the caret back in box one — after a resend clears the boxes. */
  focusFirst: () => void;
};

/**
 * The four code boxes, with the keyboard and paste behaviour that makes them
 * feel like one field.
 *
 * Extracted so email verification and password reset share **one**
 * implementation. Everything subtle lives here — select-on-focus, backspace
 * stepping back, paste filling forward — and each of those was a separate small
 * fix; a second copy would have to rediscover all of them.
 *
 * Controlled with the digit **array**, never a joined string: a user can click
 * box three and type before filling box one, and round-tripping through
 * `join("")` would silently move that digit to the front.
 */
function OtpCodeInput({
  ref,
  digits,
  onDigitsChange,
  disabled,
  invalid,
}: {
  ref?: React.Ref<OtpCodeInputHandle>;
  digits: string[];
  onDigitsChange: (digits: string[]) => void;
  disabled: boolean;
  invalid: boolean;
}) {
  const t = useTranslations("auth");
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useImperativeHandle(ref, () => ({
    focusFirst: () => inputsRef.current[0]?.focus(),
  }));

  const setDigitAt = (index: number, value: string) => {
    const next = [...digits];
    next[index] = value;
    onDigitsChange(next);
  };

  const handleChange = (index: number, raw: string) => {
    // `slice(-1)`: with select-on-focus, retyping over a filled box arrives as
    // both characters, and the new one is the one that was meant.
    const digit = raw.replace(/\D/g, "").slice(-1);

    setDigitAt(index, digit);

    if (digit && index < OTP_CODE_LENGTH - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (
    index: number,
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      // Empty box: step back and clear the one behind, so a single Backspace
      // does something rather than nothing.
      event.preventDefault();
      setDigitAt(index - 1, "");
      inputsRef.current[index - 1]?.focus();
      return;
    }

    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      inputsRef.current[index - 1]?.focus();
    }

    if (event.key === "ArrowRight" && index < OTP_CODE_LENGTH - 1) {
      event.preventDefault();
      inputsRef.current[index + 1]?.focus();
    }
  };

  /** Codes are usually pasted from the email, so one paste fills every box. */
  const handlePaste = (
    index: number,
    event: React.ClipboardEvent<HTMLInputElement>,
  ) => {
    const pasted = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, OTP_CODE_LENGTH - index);

    if (!pasted) return;

    event.preventDefault();

    const next = [...digits];
    for (let offset = 0; offset < pasted.length; offset += 1) {
      next[index + offset] = pasted[offset]!;
    }
    onDigitsChange(next);

    inputsRef.current[
      Math.min(index + pasted.length, OTP_CODE_LENGTH - 1)
    ]?.focus();
  };

  return (
    <div className="mb-3.5">
      <span id="auth-otp-label" className={labelClass}>
        {t("otpCodeLabel")}
      </span>
      <div
        role="group"
        aria-labelledby="auth-otp-label"
        className="flex items-center justify-center gap-2.5"
      >
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(element) => {
              inputsRef.current[index] = element;
            }}
            // Focus lands on the first box as the view opens.
            autoFocus={index === 0}
            type="text"
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            maxLength={1}
            disabled={disabled}
            // Strings, not numbers: ICU would group a bare number, and these
            // are positions, not counts.
            aria-label={t("otpDigitLabel", {
              position: String(index + 1),
              total: String(OTP_CODE_LENGTH),
            })}
            aria-invalid={invalid}
            value={digit}
            // Selecting on focus is what makes typing over a filled box replace
            // it instead of being swallowed by `maxLength`.
            onFocus={(event) => event.target.select()}
            onChange={(event) => handleChange(index, event.target.value)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            onPaste={(event) => handlePaste(index, event)}
            className={cn(
              "size-12 rounded-[10px] border-[0.5px] border-mx-border bg-mx-field text-center text-[18px] font-medium text-mx-fg outline-none transition-colors",
              "focus:border-mx-accent disabled:cursor-not-allowed disabled:opacity-60",
              invalid && "border-mx-accent",
            )}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * The line under the boxes: how long the code lives, and the rate-limited way
 * to get another. Shared by both code screens.
 *
 * `hasExpiry` is separate from the seconds because **an unknown expiry renders
 * nothing at all**. The login → verify path can arrive with no challenge, and
 * inventing "10:00" would be a claim the server never made.
 */
function OtpStatusRow({
  isExpired,
  hasExpiry,
  expirySeconds,
  resendSeconds,
  isResending,
  canResend,
  onResend,
}: {
  isExpired: boolean;
  hasExpiry: boolean;
  expirySeconds: number;
  resendSeconds: number;
  isResending: boolean;
  canResend: boolean;
  onResend: () => void;
}) {
  const t = useTranslations("auth");

  return (
    <div className="mb-4 flex min-h-5 items-center justify-between text-[12px]">
      <span className="text-mx-fg-faint">
        {isExpired
          ? t("otpExpiredNotice")
          : hasExpiry
            ? t("otpExpiresIn", { time: formatClock(expirySeconds) })
            : ""}
      </span>

      <button
        type="button"
        onClick={onResend}
        disabled={!canResend}
        className={cn(
          "outline-none transition-colors",
          canResend
            ? linkClass
            : "cursor-not-allowed text-mx-fg-faint opacity-60",
        )}
      >
        {isResending
          ? t("otpResending")
          : resendSeconds > 0
            ? t("otpResendIn", { seconds: resendSeconds })
            : t("otpResend")}
      </button>
    </div>
  );
}

/**
 * Seconds left until `deadline`, re-derived every tick.
 *
 * Recomputed from the target rather than decremented, so a throttled or
 * backgrounded tab catches up on return instead of drifting further behind with
 * every second it was not running.
 */
function useSecondsRemaining(deadline: number | null): number {
  const [remaining, setRemaining] = useState(() => secondsLeft(deadline));

  useEffect(() => {
    setRemaining(secondsLeft(deadline));

    if (deadline === null) return;

    const id = window.setInterval(
      () => setRemaining(secondsLeft(deadline)),
      1000,
    );

    return () => window.clearInterval(id);
  }, [deadline]);

  return remaining;
}

function secondsLeft(deadline: number | null): number {
  if (deadline === null) return 0;

  return Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
}

/**
 * `MM:SS`. Both halves padded — a clock that alternates between `9:59` and
 * `10:00` shifts width as it counts down.
 *
 * Deliberately not `format.dateTime`: this is elapsed time, not a time of day,
 * and `MM:SS` reads the same in all three languages.
 */
function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
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
  const t = useTranslations("auth");

  return (
    <div className="relative">
      <IconLock className={inputIconClass} stroke={1.75} />
      <input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        placeholder={t("passwordPlaceholder")}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        aria-invalid={invalid}
        className={inputClass}
      />
      <button
        type="button"
        onClick={onToggleVisible}
        aria-label={visible ? t("hidePassword") : t("showPassword")}
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
  disabled = false,
  children,
}: {
  isPending: boolean;
  /** Additionally unavailable — e.g. an incomplete or dead OTP code. */
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={isPending || disabled}
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
  const t = useTranslations("auth");

  return (
    <>
      <div className="my-4 flex items-center gap-3">
        <span className="h-px flex-1 bg-mx-border" />
        <span className="text-[12px] text-mx-fg-faint">{t("or")}</span>
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
  const t = useTranslations("auth");

  if (!error) return null;

  const message =
    error instanceof AuthError && error.message
      ? error.message
      : t("genericError");

  return (
    <p role="alert" className="mb-3 text-[12px] text-mx-accent">
      {message}
    </p>
  );
}

/**
 * Strength is measured against the very same `passwordSchema` the form
 * validates with, so the meter can never call something acceptable that submit
 * then rejects.
 *
 * **Weak means "does not yet pass".** Anything above weak has already cleared
 * the whole policy — length, an uppercase letter and a special character — so
 * what separates medium from strong is only what the password adds *beyond*
 * the requirements. That is why the variety count below no longer includes
 * uppercase or symbols: they are now mandatory, and scoring a password for
 * something it could not have omitted would rate every valid password strong.
 *
 * Takes the translator so the three labels stay in the message files with
 * everything else; the colours stay `--mx-*` variables so they theme.
 */
function getPasswordStrength(password: string, t: (key: string) => string) {
  if (password.length === 0) {
    return { score: 0, label: "", color: "" };
  }

  if (!passwordSchema.safeParse(password).success) {
    return { score: 1, label: t("strengthWeak"), color: "var(--mx-strength-weak)" };
  }

  // Credit for what is *not* required: extra length, lowercase, a digit.
  const bonus = [
    password.length >= STRONG_PASSWORD_LENGTH,
    /[a-z]/.test(password),
    /\d/.test(password),
  ].filter(Boolean).length;

  if (bonus >= 2) {
    return { score: 3, label: t("strengthStrong"), color: "var(--mx-strength-strong)" };
  }

  return { score: 2, label: t("strengthMedium"), color: "var(--mx-strength-medium)" };
}

/**
 * zod issues → per-field text.
 *
 * `issue.message` is a message **key** (see `@moviex/shared-types`), so it is
 * translated on the way out rather than rendered raw. Only the first issue per
 * field is kept — a stack of three messages under one input is noise.
 */
function toFieldErrors(
  issues: readonly { path: PropertyKey[]; message: string }[],
  translate: (key: string) => string,
) {
  const errors: FormErrors = {};

  for (const issue of issues) {
    const field = issue.path[0] as FieldName | undefined;
    if (field && !errors[field]) {
      errors[field] = translate(issue.message);
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
