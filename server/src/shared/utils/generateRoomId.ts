import { customAlphabet } from "nanoid";

class RoomCodeGenerator {
  private static readonly length = 6;
  private static readonly alphabet = "0123456789";

  static generate(): string {
    const nanoid = customAlphabet(
      RoomCodeGenerator.alphabet,
      RoomCodeGenerator.length
    );
    return nanoid();
  }
}

export default RoomCodeGenerator;
