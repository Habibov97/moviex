"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  IconCheck,
  IconCopy,
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
  PASSWORD_MIN_LENGTH,
  PASSWORD_SPECIAL_PATTERN,
  PASSWORD_UPPERCASE_PATTERN,
  RECOVERY_CODE_ALPHABET,
  RECOVERY_CODE_LENGTH,
  loginSchema,
  registerSchema,
  resetPasswordFormSchema,
  verifyRecoveryCodeSchema,
} from "@moviex/shared-types";

import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/shared/LogoMark";
import {
  AuthError,
  useLoginMutation,
  useResetPasswordMutation,
  useSignupMutation,
  useVerifyRecoveryCodeMutation,
} from "@/hooks/use-auth";

/**
 * The four screens this modal is.
 *
 * `saveCode` is shown once, straight after a successful signup, and is the only
 * one the user cannot leave without acknowledging. `reset` carries both halves
 * of the password recovery. They are views of one component rather than
 * separate modals because each hands off to another — a reset ends back at
 * login with the address pre-filled — and that handoff is just a `setMode`
 * when they share a parent.
 */
type AuthMode = "login" | "register" | "saveCode" | "reset";

/** The two halves of the `reset` view: enter the code, then choose a password. */
type ResetStage = "code" | "password";

/**
 * Six empty boxes. The array is the source of truth, not the joined string —
 * a user can fill box 3 before box 1, and joining would silently lose that.
 */
function emptyCharacters(): string[] {
  return Array.from({ length: RECOVERY_CODE_LENGTH }, () => "");
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
/**
 * Strength-meter tuning. **Display only** — none of this decides whether a
 * password may be submitted; `passwordSchema` alone does that.
 *
 * Six criteria, one point each (see `getPasswordStrength`). The two bucket
 * boundaries are the knobs: raise `STRONG_MIN_POINTS` to 6 if valid passwords
 * reach "strong" too readily, since 6 can only be earned by a 12+ character
 * password carrying all four character classes.
 */
/** Length earning the second of the two length points. */
const STRONG_PASSWORD_LENGTH = 12;
const MEDIUM_MIN_POINTS = 3;
const STRONG_MIN_POINTS = 5;

/*
 * Lowercase and digit are meter-only heuristics — neither is a rule in
 * `passwordSchema`, so there is nothing in `@moviex/shared-types` to import and
 * these are not a parallel copy of anything. Uppercase and "special character"
 * *are* rules, so those two patterns come from the schema's own exports rather
 * than being re-expressed here; that is what stops the meter and the validator
 * disagreeing about what counts as a symbol.
 */
const PASSWORD_LOWERCASE_PATTERN = /[a-z]/;
const PASSWORD_DIGIT_PATTERN = /\d/;

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
  | "recoveryCode"
  | "newPassword"
  | "confirmPassword";

type FormErrors = Partial<Record<FieldName, string>>;

/*
 * `text-[16px]` at the base breakpoint is **not** a design choice — see the
 * iOS note in CLAUDE.md. WebKit zooms the page in whenever a focused field's
 * computed font-size is under 16px, and never zooms back out on blur, so the
 * layout stays broken until the user pinches. It is deliberate, non-disableable
 * accessibility behaviour on Apple's part; matching the threshold is the fix.
 * 13px is restored from `md:` up, where no touch keyboard is involved.
 *
 * Every text field in this modal — login, register, both reset stages — goes
 * through this one string, which is what makes the rule hold across all of
 * them. `RecoveryCodeInput` is the exception that needs nothing: its boxes are
 * already 17px.
 */
const inputClass =
  "h-10 w-full rounded-[10px] border-[0.5px] border-mx-border bg-mx-field pl-9 pr-9 text-[16px] md:text-[13px] text-mx-fg placeholder:text-mx-fg-faint outline-none transition-colors focus:border-mx-accent aria-invalid:border-mx-accent";

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
  const [handoff, setHandoff] = useState<{
    email: string;
    notice: string;
  } | null>(null);
  /*
   * The one-time recovery code, held only while the `saveCode` view is on
   * screen. Nothing more durable than state, deliberately: this is the only
   * copy that will ever exist, and it must not outlive the modal showing it.
   */
  const [savedCode, setSavedCode] = useState<string | null>(null);
  /** Seeds the reset view, so an address typed on the login form carries. */
  const [resetEmail, setResetEmail] = useState("");
  // Lives here only so the heading can follow it; the reset token does not.
  const [resetStage, setResetStage] = useState<ResetStage>("code");

  // Adjusting state during render (React's documented alternative to an effect):
  // every reopen starts from the parent's chosen view.
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setMode(defaultMode);
      // Closing clears the handoff too, so a later open never shows a stale
      // "Password updated" notice.
      setHandoff(null);
      /*
       * An abandoned reset does not survive a reopen. Dropping this state
       * unmounts `ResetPasswordForm`, which is what discards the reset token
       * with it — closing must not leave a live credential in memory for the
       * next person to open the modal.
       */
      setResetEmail("");
      setResetStage("code");
      setSavedCode(null);
    }
  }

  /*
   * Read by the Escape handler below, which is bound once per open. A ref
   * rather than a dependency so switching views does not re-run the effect —
   * and it is assigned during render, before any keystroke can be handled.
   */
  const canDismissRef = useRef(true);

  // The only side effect the modal needs: Esc to close + body scroll lock,
  // both tied to the same open/closed lifetime.
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // `canDismissRef`, not `canDismiss`: the listener is bound once for the
      // modal's open lifetime, and re-binding it on every view change just to
      // read a boolean would also re-run the scroll lock beside it.
      if (event.key === "Escape" && canDismissRef.current) onClose();
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

  const isSaveCode = mode === "saveCode" && savedCode !== null;
  const isReset = mode === "reset";
  const isRegister = mode === "register";

  /**
   * The recovery-code view is the one screen that must not be dismissible.
   *
   * Losing this code costs the account, so a stray backdrop click or a reflexive
   * Escape is not an acceptable way to leave it — the user acknowledges, or
   * they stay. Every other view keeps the ordinary behaviour.
   */
  const canDismiss = !isSaveCode;

  /** Back to a clean login form, optionally with something to say. */
  const returnToLogin = (next?: { email: string; notice: string }) => {
    setResetStage("code");
    setHandoff(next ?? null);
    setMode("login");
  };

  const heading = isSaveCode
    ? {
        title: t("saveCodeTitle"),
        subtitle: t("saveCodeSubtitle"),
      }
    : isReset
      ? {
          title: t("resetPasswordTitle"),
          subtitle:
            resetStage === "code"
              ? t("resetCodeSubtitle")
              : t("resetPasswordSubtitle"),
        }
      : isRegister
        ? {
            title: t("createAccountTitle"),
            subtitle: t("createAccountSubtitle"),
          }
        : { title: t("welcomeBack"), subtitle: t("welcomeBackSubtitle") };

  canDismissRef.current = canDismiss;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-mx-backdrop p-4 font-mx"
      onClick={canDismiss ? onClose : undefined}
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
          {/* The shared mark, not a second inlined tile. Kept as `LogoMark`
              rather than `BrandMark` because the modal's wordmark is 15px
              against the navbar's 18px — only the icon is shared. */}
          <LogoMark size={28} />
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
        <p
          id="auth-modal-description"
          className="mt-1 text-[13px] text-mx-fg-subtle"
        >
          {heading.subtitle}
        </p>

        {/*
          Keying by mode remounts the form on every switch, so field values,
          errors and the mutation state reset themselves — no reset effect.
        */}
        {isSaveCode ? (
          <SaveRecoveryCodeView
            key="saveCode"
            code={savedCode}
            onAcknowledge={() => {
              /*
               * Signup already established the session, so there is nothing to
               * do here but drop the code and get out of the way — the user is
               * signed in the moment the modal closes.
               */
              setSavedCode(null);
              onClose();
            }}
          />
        ) : isReset ? (
          <ResetPasswordForm
            key="reset"
            initialEmail={resetEmail}
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
        ) : isRegister ? (
          <RegisterForm
            key="register"
            onRegistered={(code) => {
              setHandoff(null);
              setSavedCode(code);
              setMode("saveCode");
            }}
            onSwitchMode={() => setMode("login")}
          />
        ) : (
          <LoginForm
            key="login"
            initialEmail={handoff?.email ?? ""}
            notice={handoff?.notice ?? null}
            onSuccess={onClose}
            onForgotPassword={(email) => {
              // Carry whatever they had already typed, so the next screen is
              // usually just the code.
              setResetEmail(email);
              setHandoff(null);
              setResetStage("code");
              setMode("reset");
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
  onForgotPassword,
  onSwitchMode,
}: {
  /** Pre-filled when the user was handed back here from another view. */
  initialEmail: string;
  notice: string | null;
  onSuccess: () => void;
  /** Correct password, unverified address — finish signing up instead. */
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
    /*
     * No `onError` branch any more. A login used to have a third outcome —
     * right password, unverified address — which moved the user to a code
     * screen instead of showing an error. With verification gone, a login
     * either succeeds or the credentials are wrong, and `FormError` says so.
     */
    login.mutate(result.data, { onSuccess });
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
  /**
   * Account created **and signed in** — hand the one-time recovery code up so
   * the next view can show it. The session already exists at this point; the
   * code screen is the only thing between the user and the app.
   */
  onRegistered: (recoveryCode: string) => void;
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
      onSuccess: (response) => onRegistered(response.recoveryCode),
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
 * The recovery code, shown exactly once.
 *
 * **This is the only screen in the app that cannot be dismissed casually.**
 * Escape and backdrop clicks are disabled by the modal for this view, and the
 * Continue button stays disabled until the checkbox is ticked — because the
 * cost of leaving by accident is not "reopen it later", it is the account. The
 * server keeps a bcrypt hash and nothing else, so once this unmounts the code
 * is gone for everyone including us.
 *
 * The account is already created and already signed in by the time this
 * renders. Acknowledging closes the modal into the signed-in app; there is no
 * further step and nothing left to fail.
 */
function SaveRecoveryCodeView({
  code,
  onAcknowledge,
}: {
  code: string;
  onAcknowledge: () => void;
}) {
  const t = useTranslations("auth");
  const [acknowledged, setAcknowledged] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      /*
       * Clipboard access can be refused — an insecure origin, a permission
       * policy, an older browser. Deliberately silent: the code is displayed in
       * full right above the button, so a failed copy costs the user nothing
       * and an error message here would imply something had gone wrong with
       * the account.
       */
    }
  };

  return (
    <div className="mt-5">
      <div className="rounded-[10px] border-[0.5px] border-mx-border bg-mx-field p-4">
        <p
          // `select-all` so a click-drag or double-click takes the whole code
          // rather than one "word" of it.
          className="text-center font-mono text-[26px] leading-none font-semibold tracking-[0.28em] text-mx-fg select-all"
          // The tracking above adds a trailing gap after the last character;
          // this pulls the block back into visual centre.
          style={{ textIndent: "0.28em" }}
        >
          {code}
        </p>
      </div>

      <button
        type="button"
        onClick={handleCopy}
        className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-[10px] border-[0.5px] border-mx-border bg-mx-field-raised py-2.5 text-[13px] text-mx-fg transition-colors hover:bg-mx-field"
      >
        {copied ? (
          <>
            <IconCheck className="size-4 text-mx-success" stroke={2} />
            {t("saveCodeCopied")}
          </>
        ) : (
          <>
            <IconCopy className="size-4" stroke={1.75} />
            {t("saveCodeCopy")}
          </>
        )}
      </button>

      {/*
        The warning is `role="note"` rather than an alert: it is present from
        the moment the view renders rather than announced in response to
        something, and an assertive live region would interrupt the screen
        reader mid-heading.
      */}
      <p
        role="note"
        className="mt-4 rounded-[10px] border-[0.5px] border-mx-accent/40 bg-mx-accent/5 p-3 text-[12.5px] leading-relaxed text-mx-fg-muted"
      >
        {t("saveCodeWarning")}
      </p>

      <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-[13px] text-mx-fg-muted">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(event) => setAcknowledged(event.target.checked)}
          className="mt-0.5 size-4 shrink-0 accent-mx-accent"
        />
        <span>{t("saveCodeAcknowledge")}</span>
      </label>

      <button
        type="button"
        onClick={onAcknowledge}
        disabled={!acknowledged}
        className={cn(
          "mt-4 w-full rounded-[10px] bg-mx-accent py-2.5 text-[14px] font-medium text-mx-on-accent transition-colors",
          "hover:bg-mx-accent-hover disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        {t("saveCodeContinue")}
      </button>
    </div>
  );
}

/**
 * The whole password reset: recovery code, then the new password.
 *
 * **One component for both stages because of the token between them.**
 * `verify-recovery-code` hands back a short-lived credential that the second
 * stage spends, and it must live **only** in this component's state — never
 * `localStorage`, `sessionStorage`, a cookie or the URL. Unmounting is what
 * disposes of it, which is only true while both stages share one mount.
 *
 * This is two steps where the emailed-code flow needed three. That flow had to
 * ask the server to *send* something and then wait for it to arrive; a recovery
 * code the user already has needs no such round trip, so the address and the
 * code are collected together in one form.
 */
function ResetPasswordForm({
  initialEmail,
  onStageChange,
  onPasswordUpdated,
  onBackToLogin,
}: {
  initialEmail: string;
  onStageChange: (stage: ResetStage) => void;
  /** Password changed — back to login, pre-filled, with a confirmation. */
  onPasswordUpdated: (email: string) => void;
  onBackToLogin: () => void;
}) {
  const t = useTranslations("auth");
  const translateValidation = useValidationMessage();

  const [stage, setStage] = useState<ResetStage>("code");
  const [email, setEmail] = useState(initialEmail);
  const [characters, setCharacters] = useState<string[]>(emptyCharacters);
  /*
   * The one-time credential from stage one. State, not a ref, because the
   * password stage's submit depends on it — and nothing more durable than
   * state, so it cannot outlive the flow that minted it.
   */
  const [resetToken, setResetToken] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const verify = useVerifyRecoveryCodeMutation();
  const reset = useResetPasswordMutation();

  const code = characters.join("");
  const isComplete = code.length === RECOVERY_CODE_LENGTH;
  const canSubmitCode = isComplete && email.length > 0 && !verify.isPending;

  const goToStage = (next: ResetStage) => {
    setStage(next);
    onStageChange(next);
  };

  /*
   * **No auto-submit on the last character**, deliberately unlike the OTP
   * screen this replaced. There, the boxes were the only field and filling them
   * plainly *was* the action. Here the form also carries an email, which may
   * still be empty or wrong when the sixth letter lands — and submitting early
   * would spend one of only five attempts a minute against a code that has no
   * expiry and no second chance. The user presses the button.
   */
  const handleCodeSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const result = verifyRecoveryCodeSchema.safeParse({
      email,
      recoveryCode: code,
    });

    if (!result.success) {
      setErrors(toFieldErrors(result.error.issues, translateValidation));
      return;
    }

    setErrors({});

    verify.mutate(result.data, {
      onSuccess: (response) => {
        setResetToken(response.resetToken);
        goToStage("password");
      },
    });
  };

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
           * The ten-minute token ran out while they were choosing. Send them
           * back to the code stage rather than leaving them on a form whose
           * submit can no longer succeed — and the dead token goes with them.
           * The code itself does not expire, so it is still the right one to
           * type again.
           */
          if (
            error instanceof AuthError &&
            error.code === "RESET_TOKEN_INVALID"
          ) {
            setResetToken(null);
            setCharacters(emptyCharacters());
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
        <form onSubmit={handleCodeSubmit} className="mt-5" noValidate>
          <div className="mb-3.5">
            <label htmlFor="auth-reset-email" className={labelClass}>
              {t("emailLabel")}
            </label>
            <div className="relative">
              <IconMail className={inputIconClass} stroke={1.75} />
              <input
                autoFocus
                id="auth-reset-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder={t("emailPlaceholder")}
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

          <RecoveryCodeInput
            characters={characters}
            onCharactersChange={setCharacters}
            invalid={Boolean(verify.error || errors.recoveryCode)}
          />
          <FieldError message={errors.recoveryCode} />

          <p className="mt-1 mb-4 text-[12px] text-mx-fg-faint">
            {t("recoveryCodeHint")}
          </p>

          <FormError error={verify.error ?? reset.error} />

          <SubmitButton isPending={verify.isPending} disabled={!canSubmitCode}>
            {verify.isPending ? t("recoveryVerifying") : t("recoveryVerify")}
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

/**
 * The six code boxes, with the keyboard and paste behaviour that makes them
 * feel like one field.
 *
 * Adapted from the four-digit OTP input this replaced rather than rewritten,
 * because everything subtle in it was a separate small fix — select-on-focus,
 * backspace stepping back, paste filling forward — and a fresh implementation
 * would have to rediscover all of them. What changed is the alphabet: letters
 * instead of digits, upper-cased as they are typed, and anything outside
 * `RECOVERY_CODE_ALPHABET` is dropped rather than shown and then rejected.
 *
 * Controlled with the character **array**, never a joined string: a user can
 * click box three and type before filling box one, and round-tripping through
 * `join("")` would silently move that character to the front.
 *
 * No `ref` handle, unlike its predecessor: that existed only so a resend could
 * put the caret back in box one, and nothing is resent any more.
 */
function RecoveryCodeInput({
  characters,
  onCharactersChange,
  invalid,
}: {
  characters: string[];
  onCharactersChange: (characters: string[]) => void;
  invalid: boolean;
}) {
  const t = useTranslations("auth");
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  /**
   * Upper-cases, then drops anything outside the alphabet.
   *
   * Order matters: a lowercase `b` has to become `B` *before* the filter, or a
   * user typing in lowercase would watch every keystroke vanish.
   */
  const clean = (raw: string) =>
    raw
      .toUpperCase()
      .split("")
      .filter((character) => RECOVERY_CODE_ALPHABET.includes(character))
      .join("");

  const setCharacterAt = (index: number, value: string) => {
    const next = [...characters];
    next[index] = value;
    onCharactersChange(next);
  };

  const handleChange = (index: number, raw: string) => {
    // `slice(-1)`: with select-on-focus, retyping over a filled box arrives as
    // both characters, and the new one is the one that was meant.
    const character = clean(raw).slice(-1);

    setCharacterAt(index, character);

    if (character && index < RECOVERY_CODE_LENGTH - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (
    index: number,
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === "Backspace" && !characters[index] && index > 0) {
      // Empty box: step back and clear the one behind, so a single Backspace
      // does something rather than nothing.
      event.preventDefault();
      setCharacterAt(index - 1, "");
      inputsRef.current[index - 1]?.focus();
      return;
    }

    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      inputsRef.current[index - 1]?.focus();
    }

    if (event.key === "ArrowRight" && index < RECOVERY_CODE_LENGTH - 1) {
      event.preventDefault();
      inputsRef.current[index + 1]?.focus();
    }
  };

  /** Codes are usually pasted from wherever the user saved them. */
  const handlePaste = (
    index: number,
    event: React.ClipboardEvent<HTMLInputElement>,
  ) => {
    const pasted = clean(event.clipboardData.getData("text")).slice(
      0,
      RECOVERY_CODE_LENGTH - index,
    );

    if (!pasted) return;

    event.preventDefault();

    const next = [...characters];
    for (let offset = 0; offset < pasted.length; offset += 1) {
      next[index + offset] = pasted[offset]!;
    }
    onCharactersChange(next);

    inputsRef.current[
      Math.min(index + pasted.length, RECOVERY_CODE_LENGTH - 1)
    ]?.focus();
  };

  return (
    <div className="mb-1.5">
      <span id="auth-recovery-label" className={labelClass}>
        {t("recoveryCodeLabel")}
      </span>
      <div
        role="group"
        aria-labelledby="auth-recovery-label"
        className="flex items-center justify-center gap-1.5"
      >
        {characters.map((character, index) => (
          <input
            key={index}
            ref={(element) => {
              inputsRef.current[index] = element;
            }}
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="off"
            maxLength={1}
            // Strings, not numbers: ICU would group a bare number, and these
            // are positions, not counts.
            aria-label={t("recoveryCharacterLabel", {
              position: String(index + 1),
              total: String(RECOVERY_CODE_LENGTH),
            })}
            aria-invalid={invalid}
            value={character}
            // Selecting on focus is what makes typing over a filled box replace
            // it instead of being swallowed by `maxLength`.
            onFocus={(event) => event.target.select()}
            onChange={(event) => handleChange(index, event.target.value)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            onPaste={(event) => handlePaste(index, event)}
            className={cn(
              // Narrower than the four OTP boxes were: six have to fit the same
              // 352px panel, with the same gap rhythm.
              "size-11 rounded-[10px] border-[0.5px] border-mx-border bg-mx-field text-center text-[17px] font-medium text-mx-fg uppercase outline-none transition-colors",
              "focus:border-mx-accent disabled:cursor-not-allowed disabled:opacity-60",
              invalid && "border-mx-accent",
            )}
          />
        ))}
      </div>
    </div>
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
  /** Additionally unavailable — e.g. an incomplete recovery code. */
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
 * A running score out of six, for **progressive feedback while typing**.
 *
 * **The meter is deliberately not gated on `passwordSchema`, and reinstating
 * that gate reintroduces a real bug.** It used to return "weak" for anything
 * the schema rejected, then score only the *optional* criteria beyond that, on
 * the reasoning that crediting a password for something it could not have
 * omitted would rate every valid password strong. Sound in isolation, wrong in
 * practice: the meter sat flat at weak however long or varied the password got,
 * and the moment the last mandatory rule (a special character) was satisfied it
 * usually leapt past medium to strong, because a password that far along
 * already had most of the bonus criteria. The bar communicated nothing during
 * the part of typing where guidance is worth something.
 *
 * So mandatory criteria count too. "Strong" is now earned by a high total
 * rather than by a special zero-credit rule for the required ones, which is
 * what makes the bar fill gradually instead of stepping weak → strong.
 *
 * This changes **display only**. Whether a password is acceptable is still
 * `passwordSchema`'s answer alone, unchanged, checked at submit — so the meter
 * can read "medium" on a password that is perfectly valid, and that is correct:
 * the two are answering different questions ("how good is this?" versus "does
 * it meet the bar?"), and conflating them is what caused the bug above.
 *
 * Takes the translator so the three labels stay in the message files with
 * everything else; the colours stay `--mx-*` variables so they theme.
 */
function getPasswordStrength(password: string, t: (key: string) => string) {
  if (password.length === 0) {
    return { score: 0, label: "", color: "" };
  }

  /*
   * One point per criterion, mandatory and optional alike — the meter is not
   * gated on `passwordSchema` passing.
   *
   * Order matters only for reading: two length steps, then the four character
   * classes.
   */
  const points = [
    password.length >= PASSWORD_MIN_LENGTH,
    password.length >= STRONG_PASSWORD_LENGTH,
    PASSWORD_UPPERCASE_PATTERN.test(password),
    PASSWORD_LOWERCASE_PATTERN.test(password),
    PASSWORD_DIGIT_PATTERN.test(password),
    PASSWORD_SPECIAL_PATTERN.test(password),
  ].filter(Boolean).length;

  if (points >= STRONG_MIN_POINTS) {
    return {
      score: 3,
      label: t("strengthStrong"),
      color: "var(--mx-strength-strong)",
    };
  }

  if (points >= MEDIUM_MIN_POINTS) {
    return {
      score: 2,
      label: t("strengthMedium"),
      color: "var(--mx-strength-medium)",
    };
  }

  return {
    score: 1,
    label: t("strengthWeak"),
    color: "var(--mx-strength-weak)",
  };
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
