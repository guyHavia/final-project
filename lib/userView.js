/** The user fields that are safe to return to any client — never the hash. */
export function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    displayName: user.displayName,
  };
}

/** The editor's user-management view: the public fields plus account status and timestamps. */
export function toUserView(user) {
  return {
    ...publicUser(user),
    active: user.active,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
