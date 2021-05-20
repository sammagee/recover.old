import Hex from 'crypto-js/enc-hex'
import sha1 from 'crypto-js/sha1'

export default function filehash(file, domain = 'HomeDomain') {
  return Hex.stringify(sha1(`${domain}-${file}`));
}
