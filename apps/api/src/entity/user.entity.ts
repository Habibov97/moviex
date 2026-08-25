import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

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
   * bcrypt hash of the account's recovery code — the **only** way back into an
   * account whose password has been forgotten.
   *
   * Hashed with the same salt rounds as the password, and treated exactly like
   * one: the plaintext exists in a single HTTP response at signup and is never
   * stored, logged or recoverable afterwards. The hash cannot be reversed to
   * re-show the code, which is the property that makes "we cannot help you if
   * you lose it" a true statement rather than a policy.
   *
   * **Nullable only for rows that predate the column.** Every account created
   * from here on gets one at signup. `verifyRecoveryCode` treats a null hash as
   * a non-match rather than passing it to `bcrypt.compare`, which throws on a
   * null digest — a defensive branch, not a supported state.
   */
  @Column({ type: 'varchar', nullable: true })
  recoveryCodeHash!: string | null;

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
