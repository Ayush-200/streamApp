import { useAuth0 } from "@auth0/auth0-react";
import { protectedFetch, protectedGet, protectedPost } from "../utils/api";

export function useProtectedApi() {
  const { getAccessTokenSilently } = useAuth0();
  return {
    protectedGet: (url) => protectedGet(url, getAccessTokenSilently),
    protectedPost: (url, data) => protectedPost(url, data, getAccessTokenSilently),
    protectedFetch: (url, options) => protectedFetch(url, options, getAccessTokenSilently),
  };
}
