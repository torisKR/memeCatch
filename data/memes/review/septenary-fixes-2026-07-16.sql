begin;

-- Wrong: Armageddon dance cover was stored under Supernova
delete from meme_sources where source_url = 'https://www.tiktok.com/@ellenandbrian/video/7379436554973924651';
delete from meme_contents where url = 'https://www.tiktok.com/@ellenandbrian/video/7379436554973924651';

-- Replace weaker Armageddon (Kelly) with Ellen cover — delete Kelly first
delete from meme_sources where source_url = 'https://www.tiktok.com/@kellykimkai/video/7379932347732348177';
delete from meme_contents where url = 'https://www.tiktok.com/@kellykimkai/video/7379932347732348177';

-- Replace fan APT with ROSÉ official
delete from meme_sources where source_url = 'https://www.tiktok.com/@jen.chae/video/7428388238370393374';
delete from meme_contents where url = 'https://www.tiktok.com/@jen.chae/video/7428388238370393374';

commit;
