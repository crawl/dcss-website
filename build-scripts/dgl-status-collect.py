#!/usr/bin/python

"""Collect dgl-status files from every server, parse them and write 'dgl-status.json'.

Intended to be run every few minutes from cron."""

import time
import json
import os
import sys
import urllib2
import traceback
import ssl
import httplib
import socket
import logging

SP_TABLE = {'Mf': 'Merfolk',
            'Og': 'Ogre',
            'Na': 'Naga',
            'DD': 'Deep Dwarf',
            'DE': 'Deep Elf',
            'Tr': 'Troll',
            'Mu': 'Mummy',
            'VS': 'Vine Stalker',
            'HO': 'Hill Orc',
            'Sp': 'Spriggan',
            'Te': 'Tengu',
            'HE': 'High Elf',
            'Gr': 'Gargoyle',
            'Ko': 'Kobold',
            'Dg': 'Demigod',
            'Gh': 'Ghoul',
            'Fo': 'Formicid',
            'Ce': 'Centaur',
            'Hu': 'Human',
            'Vp': 'Vampire',
            'Op': 'Octopode',
            'Mi': 'Minotaur',
            'Gn': 'Gnoll',
            'Ha': 'Halfling',
            'Dr': 'Draconian',
            'Ds': 'Demonspawn',
            'Fe': 'Felid',
            'Ba': 'Barachi',
            'GE': 'Grey Elf*',
            'SE': 'Sludge Elf*',
            'Pl': 'Plutonian*',
            'LO': 'Lava Orc*',
            'El': 'Elf*',
            'HD': 'Hill Dwarf*',
            'OM': 'Ogre-Mage*',
            'Dj': 'Djinni*',
            'Ke': 'Kenku*',
            'MD': 'Mountain Dwarf*'}
BG_TABLE = {'CK': 'Chaos Knight',
            'AE': 'Air Elementalist',
            'DK': 'Death Knight',
            'Cj': 'Conjurer',
            'EE': 'Earth Elementalist',
            'Mo': 'Monk',
            'AM': 'Arcane Marksman',
            'Ne': 'Necromancer',
            'Su': 'Summoner',
            'VM': 'Venom Mage',
            'Sk': 'Skald',
            'FE': 'Fire Elementalist',
            'IE': 'Ice Elementalist',
            'Be': 'Berserker',
            'En': 'Enchanter',
            'Wn': 'Wanderer',
            'Hu': 'Hunter',
            'AK': 'Abyssal Knight',
            'As': 'Assassin',
            'Ar': 'Artificer',
            'Wr': 'Warper',
            'Fi': 'Fighter',
            'Gl': 'Gladiator',
            'Tm': 'Transmuter',
            'Wz': 'Wizard',
            'Pr': 'Priest*',
            'Re': 'Reaver*',
            'Pa': 'Paladin*',
            'Th': 'Thief*',
            'Cr': 'Crusader*',
            'St': 'Stalker*',
            'Jr': 'Jester*',            
            'He': 'Healer*'}
BR_TABLE = {'D': 'Dungeon',
            'Orc': 'Orcish Mines',
            'Elf': 'Elven Halls',
            'Lair': 'Lair of the Beasts',
            'Depths': 'Depths',
            'Swamp': 'Swamp',
            'Shoals': 'Shoals',
            'Spider': 'Spider Nest',
            'Snake': 'Snake Pit',
            'Slime': 'Slime Pits',
            'Vaults': 'Vaults',
            'Crypt': 'Crypt',
            'Tomb': 'Tomb of the Ancients',
            'Dis': 'Iron City of Dis',
            'Geh': 'Gehenna',
            'Coc': 'Cocytus',
            'Tar': 'Tartarus',
            'Zot':'Realm of Zot',
            'Abyss': 'Abyss',
            'Zig': 'Ziggurat',
            'Lab': 'Labyrinth',
            'Bazaar': 'Bazaar',
            'WizLab': 'Wizard\'s Laboratory',
            'Sewer': 'Sewer',
            'Bailey': 'Bailey',
            'Ossuary': 'Ossuary',
            'IceCv': 'Ice Cave',
            'Volcano': 'Volcano',
            'Hell': 'Vestibule of Hell',
            'Temple': 'Ecumenical Temple',
            'Pan': 'Pandemonium',
            'Trove': 'Treasure Trove',
            'Gauntlet': 'Gauntlet'}
MILESTONE_URL = 'https://loom.shalott.org/api/sequell/game?q=!lm+{nick}&count=1'

def get_milestone(nick):
    url = MILESTONE_URL.format(nick=nick)
    try:
        response = urllib2.urlopen(url, timeout=5)
    except (urllib2.URLError, httplib.BadStatusLine, socket.timeout) as e:
        logging.warning("Couldn't grab milestone %s (%s)" % (url, e))
        return None
    if response.getcode() != 200:
        logging.warning("%s returned status code %s, skipping." % (url, response.getcode()))
        return None
    try:
        data = response.read()
    except ssl.SSLError as e:
        logging.warning("Couldn't read milestone %s (%s)" % (url, e))
        return None
    try:
        json_response = json.loads(data)
    except StandardError:
        logging.warning("Couldn't parse milestone for %s, skipping. (%s)" % (nick, data))
        return None
    if "records" not in json_response or not json_response["records"]:
        # no milestones for character -- sequell's fetcher hasn't catch up with a new account yet
        return None
    return json_response["records"][0]

def parse_location(location):
    """Parse raw location string and return (branch, branchlevel, humanreadable).

    The human readable string is quite complex. There are six forms:
    * On level 1 of the Dungeon/Abyss/...
    * On level 1 of Tartarus/Cocytus/Gehenna
    * On level 1 of a Ziggurat
    * In a Labyrinth/Wizard Lab/...
    * In an Ice Cave/Ossuary
    * In the Vestibule of Hell/Ecumenical Temple
    * In Pandemonium
    """
    if ':' in location:
        br = location.split(':', 1)[0]
        branchlevel = location.split(':')[1]
    else:
        br = location
        branchlevel = '0'
    branch = BR_TABLE.get(br, br)

    if br in ('D', 'Orc', 'Elf', 'Lair', 'Depths', 'Swamp', 'Shoals', 'Slime', 'Snake', 'Spider', 'Vaults', 'Crypt', 'Tomb', 'Dis', 'Geh', 'Coc', 'Tar', 'Zot', 'Abyss'):
        if branchlevel != '0':
            humanreadable = "on level {} of the {}".format(branchlevel, branch)
        else:
            # zot defense or sprint
            humanreadable = "in the {}".format(branch)
    elif br in ('Tar', 'Geh', 'Coc'):
        humanreadable = "on level {} of {}".format(branchlevel, branch)
    elif br in ('Zig',):
        humanreadable = "on level {} of a {}".format(branchlevel, branch)
    elif br in ('Lab', 'Bazaar', 'WizLab', 'Sewer', 'Bailey', 'Volcano', 'Trove', 'Gauntlet'):
        humanreadable = "in a {}".format(branch)
    elif br in ('Ossuary', 'IceCv'):
        humanreadable = "in an {}".format(branch)
    elif br in ('Hell', 'Temple'):
        humanreadable = "in the {}".format(branch)
    elif br in ('Pan',):
        humanreadable = "in {}".format(branch)
    else:
        humanreadable = 'at {}'.format(location)

    return (branch, branchlevel, humanreadable)

def parse_line(line):
    if not 3 < line.count('#') < 7:
        return None
    split = line.split('#')
    game = {}
    game['name'] = split[0]
    if 'trunk' in split[1] or 'git' in split[1]:
        game['version'] = 'Trunk'
    elif '-' in split[1]:
        game['version'] = split[1].split('-')[-1]
    if 'zd' in split[1]:
        game['type'] = 'Zot Defence'
    elif 'sprint' in split[1]:
        game['type'] = 'Sprint'
    else:
        game['type'] = 'Crawl'
    if split[2]: # sometimes this field is blank
        game['XL'] = split[2].split(',')[0].split(' ')[0][1:]
        game['sp'] = split[2].split(' ')[1][:-1][:2]
        game['species'] = SP_TABLE.get(game['sp'], game['sp'])
        game['bg'] = split[2].split(' ')[1][:-1][-2:]
        game['background'] = BG_TABLE.get(game['bg'], game['bg'])
        location = split[2].split(', ')[1]
        game['branch'], game['branchlevel'], game['location'] = parse_location(location)
    if 'x' in split[3]: # indicates the field is terminal dimensions, eg '80x24'. Sometimes this field is missing
        game['idle'] = split[4]
        game['viewers'] = split[5]
    else:
        game['idle'] = split[3]
        game['viewers'] = split[4]

    return game

def get_games(servers):
    games = []

    for server in servers:
        url = server.get('dgl-status')
        if not url:
            continue
        logging.info("Loading %s" % url)
        try:
            response = urllib2.urlopen(url, timeout=5)
        except (urllib2.URLError, socket.timeout) as e:
            logging.warning("Couldn't grab dgl-status %s (%s)" % (url, e))
            continue
        if response.getcode() != 200:
            logging.warning("dgl-status %s returned status code %s, skipping." % (url, response.getcode()))
            continue
        lines = response.read().splitlines()
        logging.info("Processing %s games" % len(lines))
        for line in lines:
            try:
                game = parse_line(line)
            except StandardError as e:
                logging.warning("Couldn't parse line '%s' from %s." % (line, server['name']))
                continue
            if not game:
                logging.warning("Ignoring line '%s' from %s (doesn't have 4-6 # characters)" % (line, url))
                continue
            game['source'] = server['shortname']
            if 'watchurl' in server:
                game['watchurl'] = server['watchurl'].format(name=game['name'])
            game['latest_milestone'] = get_milestone(game['name'])
            games.append(game)

    return games

def dump_games(games, dest):
    # compact dump format
    json.dump(games, open(dest, 'w'), indent=1)

def load_servers(servers_json):
    try:
        SERVERS = json.load(open(SERVERS_JSON, 'r'))
    except StandardError:
        logging.exception("Error: couldn't load %s!" % SERVERS)
        sys.exit(1)
    return SERVERS

def main(servers, outfile):
    try:
        dump_games(get_games(servers), outfile)
    except StandardError as e:
        logging.exception("Error: unhandled exception.")
        sys.exit(1)

def acquire_lock(lockfile):
    if os.path.exists(lockfile):
        # lockfile already exists, so fail silently
        sys.exit(1)
    with open(lockfile, 'w') as f:
        f.write(str(os.getpid()))
    time.sleep(1) # realllly crappy lock race protection
    with open(lockfile, 'r') as f:
        if f.read() != str(os.getpid()):
            logging.error("Something overwrote our new lockfile?!")
            sys.exit(1)

def release_lock(lockfile):
    try:
        os.unlink(lockfile)
    except OSError as e:
        logging.error("Couldn't release lock (%s)" % e)
        sys.exit(1)

if __name__ == '__main__':
    if not 3 < len(sys.argv) < 6:
        print 'error: incorrect number of arguments'
        print 'usage: %s [-q|-v] servers.json outfile lockfile' % sys.argv[0]
        print 'eg: %s /var/www/servers.json /var/www/dgl-status.json /tmp/dgl-status-collect.lock' % sys.argv[0]
        sys.exit(1)

    # Quiet silences warnings, but not errors
    if sys.argv[1] == '-q':
        loglevel = logging.ERROR
        del(sys.argv[1])
    elif sys.argv[1] == '-v':
        loglevel = logging.INFO
        del(sys.argv[1])
    else:
        loglevel = logging.WARNING
    logging.getLogger().setLevel(loglevel)

    SERVERS_JSON = sys.argv[1]
    OUTFILE = sys.argv[2]
    LOCKFILE = sys.argv[3]

    SERVERS = load_servers(SERVERS_JSON)

    acquire_lock(LOCKFILE)
    try:
        main(SERVERS, OUTFILE)
    except KeyboardInterrupt:
        print
    finally:
        release_lock(LOCKFILE)
