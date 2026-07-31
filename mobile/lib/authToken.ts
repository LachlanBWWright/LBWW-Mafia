let token: string | null = null;
export const getAuthToken = () => token;
export const setAuthToken = (value: string | null) => { token = value; };
