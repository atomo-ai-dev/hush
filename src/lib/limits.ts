/** Input limits shared by server validation and client forms (kept free of zod). */
export const LIMITS = {
  postTitle: 100,
  postBody: 5000,
  comment: 1000,
  roomName: 40,
  chatMessage: 500,
  feedback: 2000,
} as const;

export const PAGE_SIZE = 20;
