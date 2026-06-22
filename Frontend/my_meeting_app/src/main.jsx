import React from 'react';
import { createRoot } from 'react-dom/client';
import { Auth0Provider } from '@auth0/auth0-react';
import App from './App';

const root = createRoot(document.getElementById('root'));

root.render(
 <Auth0Provider
    domain="dev-6u7dy62xhf1femi3.us.auth0.com"
    clientId="LiOcbGXMI0CAeGcaRQ3mYWweMjtyMu8F"
    authorizationParams={{
      redirect_uri: window.location.origin + '/home',
      audience: 'https://dev-6u7dy62xhf1femi3.us.auth0.com/api/v2/',
      scope: 'openid profile email'
    }}
    cacheLocation="localstorage"
    useRefreshTokens={true}
  > 
    <App />
   </Auth0Provider>
);