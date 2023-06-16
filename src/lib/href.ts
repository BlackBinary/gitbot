import {type Client} from 'pg';

export default class Href {
	dbClient: Client;

	constructor(client: Client) {
		this.dbClient = client;
	}

	isBlacklisted(url: string, blacklists: Record<string, string[]>) {
		for (const [name, list] of Object.entries(blacklists)) {
			for (const entry of list) {
				if (url.includes(entry)) {
					console.log(`[INFO] Blacklisted by ${name}/${entry}: ${url}`);
					return true;
				}
			}
		}

		return false;
	}

	async count(domainId?: number): Promise<number> {
		const result = await this.dbClient.query(
			`SELECT COUNT(*) FROM "hrefs"
			${domainId ? 'WHERE "domain_id" = $1' : ''};`,
			domainId ? [domainId] : [],
		);
		return result.rows[0].count as number;
	}

	async add(href: string, domainId: number): Promise<{id: number}> {
		const result = await this.dbClient.query(
			'INSERT INTO hrefs (href, domain_id, visited) VALUES ($1, $2, false) RETURNING id;',
			[href, domainId],
		);

		return {id: result.rows[0].id as number};
	}

	async exists(href: string): Promise<boolean> {
		const result = await this.dbClient.query('SELECT COUNT(*) FROM hrefs WHERE href = $1;', [href]);
		return result.rows[0].count > 0;
	}

	async setVisited(href: string): Promise<void> {
		console.log(`[INFO] Setting ${href} as visited`);
		await this.dbClient.query('UPDATE hrefs SET visited = true WHERE href = $1;', [href]);
	}

	async randomUnvisited(leastLike?: string): Promise<{href: string; id: number}> {
		const result = await this.dbClient.query(
			`SELECT ${leastLike ? 'similarity("hrefs"."href", $1), href, id' : 'href, id'}
			FROM hrefs INNER JOIN
			(
				SELECT COUNT(*) AS domain_count, domain_id
				FROM hrefs
				GROUP BY domain_id
			) domain_counts
			ON hrefs.domain_id = domain_counts.domain_id
			WHERE visited = false
			ORDER BY domain_counts.domain_count ASC, ${leastLike ? '"similarity" ASC' : 'random()'} LIMIT 1;
			`, leastLike ? [leastLike] : []);
		if (result.rows.length === 0) {
			return {href: '', id: 0};
		}

		if (leastLike) {
			console.log(`[INFO] Least like ${leastLike} entry in database is ${result.rows[0].href as string}`);
		}

		return {href: result.rows[0].href as string, id: result.rows[0].id as number};
	}

	async similarHrefs(href: string, limit = 10): Promise<Array<{similarity: number; href: string}>> {
		const hrefSimilarities = await this.dbClient.query(
			`SELECT similarity("hrefs"."href", $1) AS "similarity", "href"
			FROM "hrefs"
			ORDER BY "similarity" DESC
			${limit ? 'LIMIT $2' : ''}
			`,
			limit ? [href, limit] : [href],
		);
		return hrefSimilarities.rows as Array<{similarity: number; href: string}>;
	}

	async init(maxUrlLength: number): Promise<void> {
		await this.dbClient.query(`CREATE TABLE IF NOT EXISTS hrefs (
		id serial PRIMARY KEY,
		href VARCHAR (${maxUrlLength}) UNIQUE,
		domain_id INT NOT NULL,
		FOREIGN KEY (domain_id) REFERENCES domains (id) ON DELETE CASCADE,
		visited BOOLEAN
		);`);
	}
}
