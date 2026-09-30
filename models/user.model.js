import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

/** bcrypt work factor. Higher = slower to hash and to brute-force. */
const BCRYPT_COST = 12;

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Never queried by default; a login must opt in with .select('+passwordHash').
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['reporter', 'editor'], required: true },
    displayName: { type: String, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

/** Hash `plain` and store it. The plaintext is never assigned to a schema path. */
userSchema.methods.setPassword = async function setPassword(plain) {
  this.passwordHash = await bcrypt.hash(plain, BCRYPT_COST);
};

/** Resolve `true` when `plain` matches the stored hash. Requires passwordHash loaded. */
userSchema.methods.verifyPassword = function verifyPassword(plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

// A real hash at the production cost, so a login for an unknown/inactive user can
// pay for the same bcrypt work as a real one (no timing user enumeration).
const DUMMY_HASH = bcrypt.hashSync('dummy-password-never-matches', BCRYPT_COST);

/** Burn a bcrypt comparison and always resolve `false`. */
export async function verifyDummyPassword(plain) {
  await bcrypt.compare(plain, DUMMY_HASH);
  return false;
}

export const User = mongoose.model('User', userSchema);

/**
 * Create and persist a user, hashing the password with this module's rules so
 * callers (auth, the P5 seed) never touch bcrypt directly.
 */
export async function createUser({ username, password, role, displayName }) {
  const user = new User({ username, role, displayName });
  await user.setPassword(password);
  return user.save();
}
