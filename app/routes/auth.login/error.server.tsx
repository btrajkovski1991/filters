// app/routes/auth.login/error.server.tsx

export enum LoginErrorType {
  MissingShop = "MissingShop",
  InvalidShop = "InvalidShop",
}

export type LoginError = {
  shop?: LoginErrorType | string;
};

interface LoginErrorMessage {
  shop?: string;
}

export function loginErrorMessage(loginErrors: LoginError): LoginErrorMessage {
  if (loginErrors?.shop === LoginErrorType.MissingShop) {
    return { shop: "Please enter your shop domain to log in" };
  }

  if (loginErrors?.shop === LoginErrorType.InvalidShop) {
    return { shop: "Please enter a valid shop domain to log in" };
  }

  return {};
}