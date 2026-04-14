import { randomBytes, scrypt } from "crypto";

type HashResult = {
	hash: string;
	salt: string;
	keylen: number;
};

//TODO mb remove to another place?
export class Hasher {
	static async hash(plain: string): Promise<HashResult> {
		return new Promise((resolve, reject) => {
			const salt = randomBytes(16).toString("hex");
			const keylen = 32;
			scrypt(plain, salt, keylen, (err, derivedKey) => {
				if (err) {
					return reject(err);
				}
				resolve({
					hash: derivedKey.toString("hex"),
					salt: salt,
					keylen: keylen
				});
			});
		});
	}

	static async compare(plain: string, hash: string): Promise<boolean> {
		return new Promise((resolve, reject) => {
			const [salt, key, keylen] = hash.split("$");

			scrypt(plain, salt, Number(keylen), (err, derivedKey) => {
				if (err) {
					return reject(err);
				}
				resolve(key == derivedKey.toString("hex"));
			});
		});
	}
}
