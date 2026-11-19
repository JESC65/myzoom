// Only the guest's name and city are remembered (section 5.1). Never the host secret.
const KEY_NAME = 'myzoom.nombre';
const KEY_CITY = 'myzoom.ciudad';

export function loadGuest(): { nombre: string; ciudad: string } {
  try {
    return { nombre: localStorage.getItem(KEY_NAME) ?? '', ciudad: localStorage.getItem(KEY_CITY) ?? '' };
  } catch {
    return { nombre: '', ciudad: '' };
  }
}

export function saveGuest(nombre: string, ciudad: string): void {
  try {
    localStorage.setItem(KEY_NAME, nombre);
    localStorage.setItem(KEY_CITY, ciudad);
  } catch {
    // Private mode or blocked storage: nothing to do.
  }
}
