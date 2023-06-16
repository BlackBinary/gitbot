
import {Client} from 'pg';
import type Config from './config';
import Domain from './domain';
import Href from './href';
import Vcs from './vcs';

export default class Database {
	client: Client;
	domain: Domain;
	href: Href;
	vcs: Vcs;

	constructor(config: Config) {
		this.client = new Client(config.database);
		this.domain = new Domain(this.client);
		this.href = new Href(this.client);
		this.vcs = new Vcs(this.client);
	}

	async connect(): Promise<void> {
		await this.client.connect();
	}

	async init(maxUrlLength: number, drop = false): Promise<void> {
		if (drop) {
			await this.client.query(`
			CREATE SCHEMA IF NOT EXISTS bot;
			ALTER USER admin SET search_path TO bot;
			DROP SCHEMA bot CASCADE;
			CREATE SCHEMA bot;
			CREATE EXTENSION pg_trgm;`);
		}

		await this.domain.init(maxUrlLength);
		await this.href.init(maxUrlLength);
		await this.vcs.init();
	}
}
