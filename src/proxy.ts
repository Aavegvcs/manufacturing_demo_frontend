import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export const proxy = async (request: NextRequest) => {
  const response = NextResponse.next();
  return response;
};

// Match all request paths except for the ones starting with, api (API routes), _next/static (static files), _next/image (image optimization files), favicon.ico (favicon file)
export const config = {
  matcher: "/((?!api|_next/static|_next/image|favicon.ico).*)",
};
