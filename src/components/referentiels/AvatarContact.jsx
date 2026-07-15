// AvatarContact - photo du contact si presente, sinon initiales prenom+nom sur fond colore
import { colorForName, initialsFromParts } from '../../utils/avatar';
import { getContactPhoto } from '../../utils/contactPhotos';

export default function AvatarContact({ contact, size = 36 }) {
  if (!contact) return null;
  const dimension = { width: size, height: size };
  const photo = getContactPhoto(contact.id);
  const fullName = `${contact.prenom ?? ''} ${contact.nom ?? ''}`;

  if (photo) {
    return (
      <span
        className="inline-flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 flex-shrink-0 overflow-hidden"
        style={dimension}
      >
        <img src={photo} alt={fullName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center justify-center rounded-full flex-shrink-0 font-semibold text-white"
      style={{ ...dimension, backgroundColor: colorForName(fullName), fontSize: size * 0.38 }}
      title={fullName}
    >
      {initialsFromParts(contact.prenom, contact.nom)}
    </span>
  );
}
