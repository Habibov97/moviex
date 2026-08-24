import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import type { OtpPurpose } from '@moviex/shared-types';
/*
 * Relative, not `src/auth/otp.constants`. Nest's build resolves the
 * `src/…`-rooted form via `baseUrl`, but the TypeORM CLI does not — it loads
 * these files through `data-source.ts`'s `src/**\/*.entity.ts` glob under
 * `typeorm-ts-node-commonjs`, which has no such path mapping and dies with
 * `Cannot find module 'src/auth/otp.constants'` before it reaches a single SQL
 * statement. Entities are the one place both resolvers have to agree, so
 * imports here stay relative.
 */
import { OTP_PURPOSE_VALUES } from '../auth/otp.constants';

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
}

@Entity('users')
export class UserEntity extends BaseEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ unique: true })
  userName!: string;

  @Column({ unique: true })
  email!: string;

  @Column()
  password!: string;

  @Column({ default: true })
  isActive!: boolean;

  /**
   * Whether the address has been proven by entering an emailed code.
   *
   * **This is the login gate.** `AuthService.login` refuses an account with
   * `false` here, so the default matters: every row created from here on starts
   * unverified and only `verifyOtp` flips it. Accounts that existed before this
   * column did were backfilled to `true` by the migration — they predate the
   * requirement and would otherwise have been locked out of their own accounts.
   */
  @Column({ default: false })
  isEmailVerified!: boolean;

  /**
   * The pending code, or `null` once it has been used, superseded or expired
   * out. Stored as text rather than an integer so a leading zero survives —
   * `0421` is a valid code and `421` is not the same thing.
   *
   * Never selected into any response. The plaintext is deliberate: hashing a
   * 4-digit secret buys nothing against anyone holding the database, since all
   * ten thousand candidates can be tried instantly. What actually protects it
   * is the ten-minute lifetime and the attempt ceiling.
   */
  @Column({ type: 'varchar', length: 8, nullable: true })
  otpCode!: string | null;

  /** When `otpCode` stops being accepted. `null` when no code is outstanding. */
  @Column({ type: 'timestamp', nullable: true })
  otpExpiresAt!: Date | null;

  /**
   * Failed verification attempts against the *current* code. Reset to zero
   * whenever a new code is issued, so a fresh code always buys a fresh budget;
   * that is what makes "request a new code" a real way out of a lockout rather
   * than advice that does nothing.
   */
  @Column({ type: 'int', default: 0 })
  otpAttempts!: number;

  /**
   * When the last code was emailed — the resend cooldown's clock.
   *
   * Its own column rather than being derived from `otpExpiresAt` minus the
   * lifetime: that subtraction silently produces wrong cooldowns the moment
   * the lifetime is retuned, and it cannot distinguish "sent just now" from
   * "sent nine minutes ago" once the two constants disagree.
   */
  @Column({ type: 'timestamp', nullable: true })
  otpLastSentAt!: Date | null;

  /**
   * What the outstanding code is *for* — `null` when there is no code.
   *
   * **This column is what keeps two flows out of each other's way.** Email
   * verification and password reset both live in the four `otp*` fields above,
   * because a user can only be part-way through one of them at a time and a
   * second set of columns would be null in every row. The risk that creates is
   * that four digits emailed to prove an address would also open the
   * password-reset door: `verifyOtp` and `verifyResetOtp` each check this value
   * and treat a code issued for the other purpose as invalid, so the two codes
   * are not interchangeable even though they share storage.
   *
   * Requesting a code for either purpose overwrites whatever was pending for
   * the other. That is the intended behaviour, not a race to guard against —
   * the last thing the user asked for is the thing they are looking at.
   *
   * Typed as the shared `OtpPurpose` union rather than a local enum so the
   * database, the service and the client cannot disagree on the vocabulary.
   */
  @Column({
    type: 'enum',
    enum: OTP_PURPOSE_VALUES,
    nullable: true,
  })
  otpPurpose!: OtpPurpose | null;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  role!: UserRole;

  @CreateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP(6)',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP(6)',
    onUpdate: 'CURRENT_TIMESTAMP(6)',
  })
  updatedAt!: Date;
}
