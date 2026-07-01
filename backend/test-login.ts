import { compare } from "bcrypt-ts-edge";
const hashes = [
  "$2a$10$18LyCc8q9zTuaq6cS/3.dusrI7OyTWxSXQpqe0QF8pcGaeiqT9jfK",
];
const result = await compare("1111", hashes[0]);
console.log("match:", result);
