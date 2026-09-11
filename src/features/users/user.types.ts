export interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "member";
}

export interface CreateUserInput {
  name: string;
  email: string;
  role: User["role"];
}
