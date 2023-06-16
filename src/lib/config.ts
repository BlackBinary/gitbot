import {promises as fs} from 'fs';

export default class Config {
	database: {
		port: number;
		host: string;
		database: string;
		user: string;
		password: string;
	};

	blacklists: Record<string, string[]>;

	similarity: {
		hrefMax: number;
		hrefAllowed: number;
	};

	startUrls: Array<{
		url: string;
		domain: string;
	}>;

	timeout: number;

	constructor() {
		this.database = {
			port: 0,
			host: '',
			database: '',
			user: '',
			password: '',
		};

		this.blacklists = {};

		this.similarity = {
			hrefMax: 0,
			hrefAllowed: 0,
		};
		this.startUrls = [];
		this.timeout = 0;
	}

	async load(): Promise<void> {
		try {
			const config = await fs.readFile('config.json', 'utf8');
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			const configJson = JSON.parse(config);

			this.database = configJson.database as Config['database'];
			this.blacklists = configJson.blacklists as Config['blacklists'];
			this.similarity = configJson.similarity as Config['similarity'];
			this.startUrls = configJson.startUrls as Config['startUrls'];
			this.timeout = configJson.timeout as Config['timeout'];
		} catch (error: unknown) {
			console.error('Error loading config:', error);
			throw error;
		}
	}
}
