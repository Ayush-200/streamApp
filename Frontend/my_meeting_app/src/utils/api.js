// API utility with automatic Auth0 token injection

export async function protectedFetch(url, options = {}, getAccessTokenSilently) {
  try {
    const token = await getAccessTokenSilently({
      authorizationParams: {
        audience: `https://dev-6u7dy62xhf1femi3.us.auth0.com/api/v2/`,
      }
    });

    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Request failed');
    }

    return response;
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
}

// Helper for common GET requests
export async function protectedGet(url, getAccessTokenSilently) {
  return protectedFetch(url, { method: 'GET' }, getAccessTokenSilently);
}

// Helper for common POST requests
export async function protectedPost(url, data, getAccessTokenSilently) {
  return protectedFetch(url, {
    method: 'POST',
    body: JSON.stringify(data)
  }, getAccessTokenSilently);
}
