import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const KEY = 'core_session_user_id';

// No celular usa o armazenamento seguro; na web (só para testes) usa localStorage.
export async function saveSession(userId) {
  try {
    if (Platform.OS === 'web') localStorage.setItem(KEY, String(userId));
    else await SecureStore.setItemAsync(KEY, String(userId));
  } catch (e) {
    console.error('Erro ao salvar sessão:', e);
  }
}

export async function loadSession() {
  try {
    const v =
      Platform.OS === 'web' ? localStorage.getItem(KEY) : await SecureStore.getItemAsync(KEY);
    const id = parseInt(v, 10);
    return Number.isNaN(id) ? null : id;
  } catch (e) {
    console.error('Erro ao ler sessão:', e);
    return null;
  }
}

export async function clearSession() {
  try {
    if (Platform.OS === 'web') localStorage.removeItem(KEY);
    else await SecureStore.deleteItemAsync(KEY);
  } catch (e) {
    console.error('Erro ao limpar sessão:', e);
  }
}