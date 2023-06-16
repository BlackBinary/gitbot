/* eslint-disable no-await-in-loop */
import http from './lib/http';
import Config from './lib/config';
import Database from './lib/database';

let db: Database;
let config: Config;

const maxUrlLength = 2048;
const drop = false;

let crawlerStarted: Date;

const checkSimilarity = async (href: string): Promise<boolean> => {
	if (await db.href.exists(href)) {
		console.log(`[INFO] ${href} already exists in database.`);
		return true;
	}

	const similarHrefs = await db.href.similarHrefs(href);
	const tooSimilar = similarHrefs.filter(h => h.similarity >= config.similarity.hrefMax);
	if (tooSimilar.length >= config.similarity.hrefAllowed) {
		console.log(`[INFO] Too similar ${href} detected. ${tooSimilar.length} similar hrefs found of ${config.similarity.hrefMax}, when ${config.similarity.hrefAllowed} is allowed.`);
		return true;
	}

	return false;
};

const crawl = async (lastVisited = ''): Promise<void> => {
	const href = await db.href.randomUnvisited(lastVisited);
	crawlerStarted = new Date();
	console.log(`[INFO] Crawler starting for ${href.href} at ${crawlerStarted.toISOString()}`);
	await db.href.setVisited(href.href);

	const html = await http.fetchPage(href.href);
	const hrefs = http.extractHrefsFromHtml(html);

	const hrefMap = new Map<string, Set<string>>();

	for (const href of hrefs) {
		if (db.href.isBlacklisted(href, config.blacklists)) {
			continue;
		}

		const domain = (new URL(href)).hostname;
		if (!hrefMap.has(domain)) {
			hrefMap.set(domain, new Set());
		}

		hrefMap.get(domain)!.add(href);
	}

	for (const [domain, hrefs] of hrefMap) {
		const {id: domainId} = await db.domain.add(domain);
		console.log(`[INFO] Adding domain ${domain}`);
		for (const href of hrefs) {
			const similar = await checkSimilarity(href);
			if (similar) {
				continue;
			}

			console.log(`[INFO] Adding ${href} to domain ${domain}`);
			await db.href.add(href, domainId);
		}
	}

	await crawl(href.href);
};

const scanner = async (): Promise<void> => {
	const {domain, id} = await db.vcs.nextDomain();
	const git = await http.checkGit(domain);

	console.log(`[INFO] Checking ${domain} for git...`);
	if (git.length > 0) {
		await Promise.all(git.map(async href => {
			console.log(`[INFO] Git found at ${href} [${domain}]`);

			await db.vcs.add(href, id);
		}));
	} else {
		await db.vcs.add('none', id);
	}

	await scanner(); // \copy domains TO 'domains.csv' CSV DELIMITER ','
};

(async () => {
	config = new Config();
	await config.load();

	db = new Database(config);
	await db.connect();
	await db.init(maxUrlLength, drop);

	if (process.env.CRAWLER) {
		if ((await db.href.randomUnvisited()).href === '') {
			console.log('[INFO] No unvisited hrefs found, adding start urls to database.');
			for (const {url, domain} of config.startUrls) {
				const {id: domainId} = await db.domain.add(domain);
				await db.href.add(url, domainId);
			}
		}

		setInterval(() => {
			const endTime = new Date();
			let timeDiff = endTime.getMilliseconds() - crawlerStarted.getMilliseconds();
			timeDiff /= 1000;

			const seconds = Math.round(timeDiff);
			if (seconds > config.timeout) {
				console.log(`[INFO] Crawler timed out after ${seconds} seconds.`);
				process.exit(0);
			}
		}, 10000);

		await crawl();
	}

	if (process.env.SCANNER) {
		console.log('[INFO] Scanner starting.');
		await scanner();
	}
})();
