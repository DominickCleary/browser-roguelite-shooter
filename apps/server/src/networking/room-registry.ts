const roomsByCode = new Map<string, string>();

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const registerRoom = (roomId: string): string => {
  for (let attempt = 0; attempt < 100; attempt++) {
    let code = "";
    for (let index = 0; index < 4; index++) {
      code += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    if (!roomsByCode.has(code)) {
      roomsByCode.set(code, roomId);
      return code;
    }
  }
  throw new Error("Could not allocate a room code.");
};

export const unregisterRoom = (code: string): void => {
  roomsByCode.delete(code);
};

export const resolveRoom = (code: string): string | undefined => roomsByCode.get(code.toUpperCase());
