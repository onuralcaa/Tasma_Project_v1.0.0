// Mock/Test API responses için
export const mockAuth = {
  register: async (userName, passWord) => {
    // Simüle edilmiş başarılı kayıt
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ success: true, message: 'Mock kayıt başarılı' });
      }, 1000);
    });
  },
  
  login: async (userName, passWord) => {
    // Simüle edilmiş başarılı giriş
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ 
          success: true, 
          token: 'mock_token_' + Date.now(),
          message: 'Mock giriş başarılı' 
        });
      }, 1000);
    });
  }
};
