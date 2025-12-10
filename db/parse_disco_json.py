#!/usr/bin/env python3
"""
Parse Disco Elysium.json into a SQLite3 database.
Converts the Unity dialogue JSON export into a normalized SQL database.
"""
from encodings.punycode import T
from enum import Enum
import json
import re
import sqlite3
import sys
from pathlib import Path
import logging

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def drop_all_tables(db_path: str):
    # Get all user-defined table names
    connection = sqlite3.connect(str(db_path))
    cursor = connection.cursor()
    cursor.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")
    tables = cursor.fetchall()

    # Drop each table
    for table_name_tuple in tables:
        table_name = table_name_tuple[0]
        drop_statement = f"DROP TABLE IF EXISTS {table_name};"
        cursor.execute(drop_statement)
        print(f"Dropped table: {table_name}")

    connection.commit()
    connection.close()


class TypeString(Enum):
    DEFAULT = 0
    CustomFieldType_Number = 1
    CustomFieldType_Boolean = 2
    CustomFieldType_Actor = 5


class DiscoDBParser:
    """Parser for Disco Elysium JSON dialogue data into SQLite."""

    def __init__(self, json_path: str, schema_path: str, db_path: str):
        """Initialize parser with input JSON and output database paths."""
        self.json_path = Path(json_path)
        self.db_path = Path(db_path)
        self.schema_path = Path(schema_path)
        self.connection: sqlite3.Connection
        self.cursor: sqlite3.Cursor
        self.data: dict
        self.ACTOR_FIELD_MAP = {
            "id": lambda actor, fields: actor.get("id"),
            "name": lambda actor, fields: self._get_field_value(fields, "Name"),
            "description": lambda actor, fields: self._get_field_value(fields, "Description"),
            "characterShortName": lambda actor, fields: self._get_field_value(fields, "character_short_name"),
            "shortDescription": lambda actor, fields: self._get_field_value(fields, "short_description"),
            "longDescription": lambda actor, fields: self._get_field_value(fields, "LongDescription"),
            "color": lambda actor, fields: self._parse_number(self._get_field_value(fields, "color")),
            "articyId": lambda actor, fields: self._get_field_value(fields, "Articy Id"),
            "pictures": lambda actor, fields: self._get_field_value(fields, "Pictures"),
            "isFemale": lambda actor, fields: self._parse_bool(self._get_field_value(fields, "IsFemale")),
            "talkativeness": lambda actor, fields: self._parse_number(self._get_field_value(fields, "Talkativeness")),
        }

        self.ITEM_DATA_MAP = {
            "id": lambda item, fields: item.get("id"),
            "name": lambda item, fields: self._get_field_value(fields, 'Name'),
            "description": lambda item, fields: self._coalesce_field_values(fields, ['description', 'Description']),
            "characterShortName": lambda item, fields: self._get_field_value(fields, 'character_short_name'),
            "isCursed": lambda item, fields: self._parse_bool(self._coalesce_field_values(fields, ['Cursed', 'cursed'])),
            "fixtureBonus": lambda item, fields: self._get_field_value(fields, 'fixtureBonus'),
            "requirement": lambda item, fields: self._get_field_value(fields, 'requirement'),
            "bonus": lambda item, fields: self._get_field_value(fields, 'bonus'),
            "thoughtType": lambda item, fields: self._get_field_value(fields, 'thoughtType'),
            "isThought": lambda item, fields: self._parse_bool(self._get_field_value(fields, 'isThought')),
            "fixtureDescription": lambda item, fields: self._get_field_value(fields, 'fixtureDescription'),
            "autoequip": lambda item, fields: self._parse_bool(self._get_field_value(fields, 'autoequip')),
            "itemType": lambda item, fields: self._parse_number(self._get_field_value(fields, 'itemType')),
            "conversation": lambda item, fields: self._get_field_value(fields, 'conversation'),
            "timeLeft": lambda item, fields: self._parse_number(self._get_field_value(fields, 'timeLeft')),
            "isSubstance": lambda item, fields: self._parse_bool(self._get_field_value(fields, 'isSubstance')),
            "stackName": lambda item, fields: self._get_field_value(fields, 'stackName'),
            "sound": lambda item, fields: self._parse_number(self._get_field_value(fields, 'sound')),
            "isConsumable": lambda item, fields: self._parse_bool(self._get_field_value(fields, 'isConsumable')),
            "itemGroup": lambda item, fields: self._parse_number(self._get_field_value(fields, 'itemGroup')),
            "equipOrb": lambda item, fields: self._get_field_value(fields, 'equipOrb'),
            "itemValue": lambda item, fields: self._parse_number(self._get_field_value(fields, 'itemValue')),
            "mediumTextValue": lambda item, fields: self._get_field_value(fields, 'MediumTextValue'),
            "multipleAllowed": lambda item, fields: self._parse_bool(self._get_field_value(fields, 'multipleAllowed')),
            "articyId": lambda item, fields: self._get_field_value(fields, 'Articy Id'),
        }

        self.VARIABLE_MAP = {
            'id': lambda variable, fields: variable.get('id'),
            'name': lambda variable, fields: self._get_field_value(fields, 'Name'),
            'initialvalue': lambda variable, fields: self._get_field_value(fields, 'Initial Value'),
            'description': lambda variable, fields: self._get_field_value(fields, 'Description'),
        }

        self.OUTGOING_LINKS_MAP = {
            'originconversationid': lambda link, fields: link.get('originConversationID'),
            'origindialogueid': lambda link, fields: link.get('originDialogueID'),
            'destinationconversationid': lambda link, fields: link.get('destinationConversationID'),
            'destinationdialogueid': lambda link, fields: link.get('destinationDialogueID'),
            'isConnector': lambda link, fields: self._parse_bool(link.get('isConnector', 0)),
            'priority': lambda link, fields: link.get('priority', 2)
        }

        self.DIALOGUE_ENTRY_MAP = {
            'id': lambda entry, fields: entry.get("id"),
            'conversationid': lambda entry, fields: entry.get("conversationID"),
            'title': lambda entry, fields: self._get_field_value(fields, 'Title'),
            'dialoguetext': lambda entry, fields: self._get_field_value(fields, 'Dialogue Text'),
            'articyId': lambda entry, fields: self._get_field_value(fields, 'Articy Id'),
            'sequence': lambda entry, fields: self._get_field_value(fields, 'Sequence'),
            'dialogueEntryType': lambda entry, fields: self._get_field_value(fields, 'DialogueEntryType'),
            'actor': lambda entry, fields: self._parse_number(self._get_field_value(fields, 'Actor')),
            'conversant': lambda entry, fields: self._parse_number(self._get_field_value(fields, 'Conversant')),
            'outputId': lambda entry, fields: self._get_field_value(fields, 'OutputId'),
            'inputId': lambda entry, fields: self._get_field_value(fields, 'InputId'),
            'forced': lambda entry, fields: self._parse_bool(self._get_field_value(fields, 'Forced')),
            'menuText': lambda entry, fields: self._get_field_value(fields, 'Menu Text'),
            'flagname': lambda entry, fields: self._get_field_value(fields, 'FlagName'),
            'isGroup': lambda entry, fields:  self._parse_bool(entry.get('isGroup')),
            'conditionstring': lambda entry, fields:  entry.get('conditionsString'),
            'userscript': lambda entry, fields:  entry.get('userScript')
        }

    def build_task_map(self, entry, fields):
        task_map = {
            "dialogueid": entry.get("id"),
            "conversationid": entry.get("conversationID"),
            "name": self._get_field_value(fields, "Title"),
            "descriptionCondition": self._get_field_value(fields, "Description"),
            "displayCondition": self._get_field_value(fields, "display_condition_main"),
            "doneCondition": self._get_field_value(fields, "done_condition_main"),
            "cancelCondition": self._get_field_value(fields, "cancel_condition_main"),
            "taskReward": self._get_field_value(fields, "task_reward"),
            "isTimed": self._parse_bool(self._get_field_value(fields, "task_timed")),
        }
        check_if_none = ["name", "descriptionCondition", "displayCondition",
                         "doneCondition", "cancelCondition", "taskReward", "isTimed"]
        for v in check_if_none:
            if task_map[v] is not None:
                return task_map
        return None

    # Insert single row, for objects like actors, dialogues, and items
    def insert_row(self, table: str, field_map: dict, json_obj: dict):
        fields = json_obj.get("fields", [])
        column_names = ", ".join(field_map.keys())
        placeholders = ", ".join("?" for _ in field_map)
        sql = f"INSERT OR REPLACE INTO {table} ({column_names}) VALUES ({placeholders})"
        values = [func(json_obj, fields) for func in field_map.values()]
        if (self.cursor is not None):
            self.cursor.execute(sql, values)

    def executeScriptsFromFile(self):
        """Load and parse the SQL schema file."""
        try:
            logger.info(f"Loading SQL from {self.schema_path}")
            with open(self.schema_path, 'r', encoding='utf-8') as f:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                # Open and read the file as a single buffer
                sqlFile = f.read()

                # all SQL commands (split on ';')
                sqlCommands = sqlFile.split(';')

                # Execute every command from the input file
                for command in sqlCommands:
                    try:
                        logger.debug(f"Executing SQL: {command}")
                        cursor.execute(command)
                    except Exception as e:
                        logger.error(f"Error executing SQL file: {e}")
                        return False
            return True
        except Exception as e:
            logger.error(f"Error loading JSON: {e}")
            return False

    def insert_item(self, table: str, item: dict):
        keys = list(item.keys())
        cols = ", ".join(keys)
        placeholders = ", ".join(["?"] * len(keys))
        values = list(item.values())

        sql = f"INSERT INTO {table} ({cols}) VALUES ({placeholders})"
        self.connection.execute(sql, values)
        self.connection.commit()

    def clean_conversation_titles(self, title, convo_type) -> str:
        display_title = ""
        if title is not None:
            display_title = title
            
        bark_pattern = rf"\b{re.escape("bark")}s?\b"
        orb_pattern = rf"\b{re.escape("orb")}?\b"
        wcw_pattern = rf"\b{re.escape("WCW")}?\b"

        display_title = re.sub(bark_pattern, '', display_title, flags=re.IGNORECASE)
        display_title = re.sub(wcw_pattern, 'WORKING CLASS WOMAN', display_title, flags=re.IGNORECASE)
        display_title = re.sub(orb_pattern, '', display_title, flags=re.IGNORECASE)
        
        # Replace one or more whitespace characters with a single space
        # and then remove leading/trailing spaces
        display_title = re.sub(r'\s+', ' ', display_title).strip()
                
        if convo_type == 'task':
            display_title = f"TASK / {display_title}"
        return display_title

    def mark_conversations_hidden(self, title, description) -> bool:
        if (description is not None and 'obsolete' in description.lower()) or (title is not None and 'obsolete' in title.lower()):
            return True
        if (description is not None and 'delete' in description.lower()) or (title is not None and 'delete' in title.lower()):
            return True
        return False

    def load_json(self) -> bool:
        """Load and parse the JSON file."""
        try:
            logger.info(f"Loading JSON from {self.json_path}")
            with open(self.json_path, 'r', encoding='utf-8') as f:
                self.data = json.load(f)
            logger.info(f"Successfully loaded JSON")
            return True
        except Exception as e:
            logger.error(f"Error loading JSON: {e}")
            return False

    def create_database(self) -> bool:
        """Create SQLite database and tables."""
        try:
            logger.info(f"Creating database at {self.db_path}")
            self.connection = sqlite3.connect(str(self.db_path))
            self.cursor = self.connection.cursor()

            # Read and execute schema
            self.executeScriptsFromFile()
            self.connection.commit()
            logger.info("Database tables created successfully")
            return True
        except Exception as e:
            logger.error(f"Error creating database: {e}")
            if self.connection:
                self.connection.rollback()
            return False

    def _coalesce_field_values(self, fields: list[dict], field_names: list[str], default=None) -> object | None:
        """Get the first non-null value from the list of field names."""
        if not field_names or len(field_names) == 0:
            return default
        if len(field_names) == 1:
            return self._get_field_value(fields, field_names[0])
        for name in field_names:
            value = self._get_field_value(fields, name)
            if self.is_real_value(value):
                return value
        return default

    def _get_field_value(self, fields: list[dict], field_name: str) -> object | None:
        """Extract a field value from the fields list by title."""
        if not fields:
            return None
        for field in fields:
            if field.get('title') == field_name:
                value = field.get('value')
                # Convert string booleans to actual booleans
                if value == "True":
                    return True
                elif value == "False":
                    return False
                if not self.is_real_value(value):
                    return None
                return value
        return None

    def _parse_bool(self, value: object) -> bool | None:
        """Parse a boolean value."""
        if not self.is_real_value(value):
            return None
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            return value.lower() in ('true', '1', 'yes')
        return bool(value)

    def _parse_number(self, value) -> float | None:
        """Parse a numeric value."""
        if not self.is_real_value(value):
            return None
        try:
            return float(value)
        except (ValueError, TypeError):
            return None

    def is_real_value(self, value):
        if value is None:
            return False
        if isinstance(value, str):
            if value.strip() == "":
                return False
            if value.strip() == "\"\"":
                return False
        return True

    def parse_actors(self) -> bool:
        """Parse actors from JSON and insert into database."""
        if not self.data or not self.connection:
            return False
        try:
            logger.info("Parsing actors...")
            actors = self.data.get('actors', [])
            logger.info(f"Found {len(actors)} actors")

            for actor in actors:
                self.insert_row("actors", self.ACTOR_FIELD_MAP, actor)

            self.connection.commit()
            logger.info(f"Successfully inserted {len(actors)} actors")
            return True
        except Exception as e:
            logger.error(f"Error parsing actors: {e}")
            self.connection.rollback()
            return False

    def parse_items(self) -> bool:
        """Parse items from JSON and insert into database."""
        if not self.data or not self.connection:
            return False
        try:
            logger.info("Parsing item...")
            items = self.data.get('items', [])
            logger.info(f"Found {len(items)} items")

            for item in items:
                self.insert_row("items", self.ITEM_DATA_MAP, item)

            self.connection.commit()
            logger.info(f"Successfully inserted {len(items)} items")
            return True
        except Exception as e:
            logger.error(f"Error parsing items: {e}")
            self.connection.rollback()
            return False

    def parse_variables(self) -> bool:
        """Parse variables from JSON and insert into database."""
        if self.data is None or self.connection is None or self.cursor is None:
            return False
        try:
            logger.info("Parsing variables...")
            variables = self.data.get('variables', [])
            logger.info(f"Found {len(variables)} variables")

            for variable in variables:
                self.insert_row("variables", self.VARIABLE_MAP, variable)

            self.connection.commit()
            logger.info(f"Successfully inserted {len(variables)} variables")
            return True
        except Exception as e:
            logger.error(f"Error parsing variables: {e}")
            self.connection.rollback()
            return False

    def parse_conversations(self) -> bool:
        """Parse conversations from JSON and insert into database."""
        if self.data is None or self.connection is None or self.cursor is None:
            return False
        try:
            logger.info("Parsing conversations...")
            conversations = self.data.get('conversations', [])
            logger.info(f"Found {len(conversations)} conversations")

            for convo in conversations:
                convo_id = convo.get('id')
                fields = convo.get('fields', [])

                title = self._get_field_value(fields, 'Title')
                description = self._get_field_value(fields, 'Description')
                placement = self._get_field_value(fields, 'Placement')

                overrides = convo.get('overrideSettings', {})
                convo_type = 'flow'
                total_subtasks = 0

                subtasks_blocks = []
                for i in range(1, 13):
                    suffix = f"_{i:02d}"
                    subtasks_blocks.append({
                        "id": i,
                        "conversationid": convo_id,
                        "name": self._get_field_value(fields, f"subtask_title{suffix}"),
                        "isTimed": self._parse_bool(self._get_field_value(fields, f"timed_subtask{suffix}")),
                        "displayCondition": self._get_field_value(fields, f"display_subtask{suffix}"),
                        "doneCondition": self._get_field_value(fields, f"done_subtask{suffix}"),
                        "cancelCondition": self._get_field_value(fields, f"cancel_subtask{suffix}"),
                    })

                # Parse subtasks - Multiple per conversation if task
                for block in subtasks_blocks:
                    if block.get("name") is not None or block.get("displayCondition") is not None or block.get("doneCondition") is not None or block.get("cancelCondition") is not None:
                        self.cursor.execute("""
                            INSERT INTO subtasks
                            (id, conversationid, name, isTimed, displayCondition, doneCondition, cancelCondition)
                            VALUES (?, ?, ?, ?, ?, ?, ?)
                    """, (block.get("id"), block.get("conversationid"), block.get("name"), block.get("isTimed"), block.get("displayCondition"), block.get("doneCondition"), block.get("cancelCondition")))
                        total_subtasks += 1

                display_condition_main = self._get_field_value(
                    fields, "display_condition_main")
                done_condition_main = self._get_field_value(
                    fields, "done_condition_main")
                cancel_condition_main = self._get_field_value(
                    fields, "cancel_condition_main")
                task_reward = self._get_field_value(fields, "task_reward")
                task_timed = self._parse_bool(
                    self._get_field_value(fields, "task_timed"))

                if display_condition_main is not None or done_condition_main is not None or cancel_condition_main is not None or task_reward is not None or task_timed is not None:
                    convo_type = 'task'
                if ((placement is not None and placement != "") or (title is not None and (str(title).upper().startswith("ARX - EASTEREGGS") or str(title).upper().startswith("HELEN - EASTEREGGS") or str(title).upper().startswith("LAIR ORB / FOOTPRINTS"))) and (not str(title).upper().startswith("BOARDWALK / PAYPHONE"))):
                    convo_type = 'orb'  # includes orbs with and without subsequent dialogues

                convo_data = {
                    'id': convo_id,
                    'title': title,
                    'articyId': self._get_field_value(fields, 'Articy Id'),
                    'onUse': self._get_field_value(fields, 'OnUse'),
                    'overrideDialogueCondition': self._get_field_value(fields, 'OverrideDialogueCondition'),
                    'alternateOrbText': self._get_field_value(fields, 'AlternateOrbText'),
                    'checkType': self._get_field_value(fields, 'CheckType'),
                    'condition': self._get_field_value(fields, 'Condition'),
                    'instruction': self._get_field_value(fields, 'Instruction'),
                    'placement': placement,
                    'difficulty': self._get_field_value(fields, 'Difficulty'),
                    'description': description,
                    'actor': self._parse_number(self._get_field_value(fields, 'Actor')),
                    'conversant': self._parse_number(self._get_field_value(fields, 'Conversant')),
                    'displayConditionMain': display_condition_main,
                    'doneConditionMain': done_condition_main,
                    'cancelConditionMain': cancel_condition_main,
                    'taskReward': task_reward,
                    'taskTimed': task_timed,
                    'type': convo_type,
                    'totalSubtasks': total_subtasks,
                    'displayTitle': self.clean_conversation_titles(title, convo_type),
                    'isHidden': self.mark_conversations_hidden(title, description),
                }

                self.cursor.execute("""
                    INSERT OR REPLACE INTO conversations 
                    (id, title, articyId, onUse, overrideDialogueCondition, alternateOrbText, checkType, 
                     condition, instruction, placement, difficulty, description, actor, conversant, 
                     displayConditionMain, doneConditionMain, cancelConditionMain, taskReward, taskTimed,
                     type, totalSubtasks, displayTitle, isHidden
                     )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, tuple(convo_data.values()))

            self.connection.commit()
            logger.info(
                f"Successfully inserted {len(conversations)} conversations")
            return True
        except Exception as e:
            logger.error(f"Error parsing conversations: {e}")
            self.connection.rollback()
            return False

    def parse_dialogue_entries(self) -> bool:
        """Parse dialogue entries from conversations."""
        if self.data is None or self.connection is None or self.cursor is None:
            return False
        try:
            logger.info("Parsing dialogue entries...")
            conversations = self.data.get('conversations', [])
            total_entries = 0
            total_alternates = 0
            total_modifiers = 0
            total_white_checks = 0
            total_passive_checks = 0
            total_red_checks = 0

            for convo in conversations:
                convo_id = convo.get('id')
                entries = convo.get('dialogueEntries', [])

                for entry in entries:
                    entry_id = entry.get('id')
                    fields = entry.get('fields', [])
                    entry_checks = 0
                    entry_alternates = 0
                    entry_modifiers = 0

                    self.insert_row("dentries", self.DIALOGUE_ENTRY_MAP, entry)

                    alternate_blocks = []
                    for i in range(1, 5):
                        alternate_blocks.append({
                            "id": i,
                            "condition": self._get_field_value(fields, f"Condition{i}"),
                            "alternate": self._get_field_value(fields, f"Alternate{i}")
                        })

                    modifier_blocks = []
                    for i in range(1, 11):
                        modifier_blocks.append({
                            "id": i,
                            "modifier": self._parse_number(self._get_field_value(fields, f"modifier{i}")),
                            "variable": self._get_field_value(fields, f"variable{i}"),
                            "tooltip":  self._get_field_value(fields, f"tooltip{i}")
                        })

                    dialogue_text = self._get_field_value(
                        fields, 'Dialogue Text')

                    # Parse alternates - Multiple per entry
                    for block in alternate_blocks:
                        if block["alternate"] is not None or block["condition"] is not None:
                            self.cursor.execute("""
                                INSERT INTO alternates (id, conversationid, dialogueid, alternateline, condition, replaces)
                                VALUES (?, ?, ?, ?, ?, ?)
                            """, (block["id"], convo_id, entry_id, block["alternate"], block["condition"], dialogue_text))
                            entry_alternates += 1
                            total_alternates += 1

                    # Parse modifiers - Multiple per entry
                    for block in modifier_blocks:
                        if block["modifier"] is not None or block["variable"] is not None or block["tooltip"] is not None:
                            self.cursor.execute("""
                                INSERT INTO modifiers (id, conversationid, dialogueid, modifier, variable, tooltip)
                                VALUES (?, ?, ?, ?, ?, ?)
                            """, (block["id"], convo_id, entry_id, block["modifier"], block["variable"], block["tooltip"]))
                            entry_modifiers += 1
                            total_modifiers += 1

                    # Parse outgoing links - Multiple per entry
                    link_count = 0
                    links = entry.get('outgoingLinks', [])
                    for link in links:
                        self.insert_row(
                            "dlinks", self.OUTGOING_LINKS_MAP, link)
                        link_count += 1

                    # Parse checks - 1 check per entry, supporting multiple for now
                    difficultypassive = self._parse_number(
                        self._get_field_value(fields, 'DifficultyPass'))
                    difficultywhite = self._parse_number(
                        self._get_field_value(fields, 'DifficultyWhite'))
                    difficultyred = self._parse_number(
                        self._get_field_value(fields, 'DifficultyRed'))
                    skilltype = self._get_field_value(fields, 'SkillType')
                    check_target = self._get_field_value(
                        fields, 'check_target')

                    # Update to switch statement, only one can be true at once
                    if difficultypassive is not None:
                        self.cursor.execute("""
                            INSERT INTO checks
                            (conversationid, dialogueid, checktype, skilltype, check_target, difficulty)
                            VALUES (?, ?, ?, ?, ?, ?)
                        """, (convo_id, entry_id, 'passive', skilltype, check_target, difficultypassive))
                        entry_checks += 1
                        total_passive_checks += 1

                    if difficultywhite is not None:
                        self.cursor.execute("""
                            INSERT INTO checks
                            (conversationid, dialogueid, checktype, skilltype, check_target, difficulty)
                            VALUES (?, ?, ?, ?, ?, ?)
                        """, (convo_id, entry_id, 'white', skilltype, check_target, difficultywhite))
                        entry_checks += 1
                        total_white_checks += 1

                    if difficultyred is not None:
                        self.cursor.execute("""
                            INSERT INTO checks
                            (conversationid, dialogueid, checktype, skilltype, check_target, difficulty)
                            VALUES (?, ?, ?, ?, ?, ?)
                        """, (convo_id, entry_id, 'red', skilltype, check_target, difficultyred))
                        entry_checks += 1
                        total_red_checks += 1

                    self.cursor.execute("""
                            UPDATE dentries
                            SET hasAlts = ?, hasCheck = ?, totalModifiers = ?
                            WHERE conversationid = ? and id = ?
                        """, (entry_alternates > 0, entry_checks > 0, entry_modifiers, convo_id, entry_id))
                    total_entries += 1

            self.connection.commit()
            logger.info(
                f"Successfully inserted {total_entries} dialogue entries")
            logger.info(
                f"Successfully inserted {total_alternates} alternate entries")
            logger.info(
                f"Successfully inserted {total_modifiers} modifier entries")
            return True
        except Exception as e:
            logger.error(f"Error parsing dialogue entries: {e}")
            self.connection.rollback()
            return False

    def calculate_talkativeness(self) -> bool:
        """Calculate talkativeness for each actor based on dialogue line count."""
        if self.data is None or self.connection is None or self.cursor is None:
            return False
        try:
            logger.info("Calculating talkativeness for actors...")

            # Get count of dialogue lines per actor
            self.cursor.execute("""
                SELECT actor, COUNT(*) as line_count
                FROM dentries
                WHERE actor IS NOT NULL
                GROUP BY actor
            """)

            actor_line_counts = self.cursor.fetchall()

            if not actor_line_counts:
                logger.warning(
                    "No dialogue entries found to calculate talkativeness")
                return True

            # Update talkativeness for each actor (total number of lines)
            for actor_id, line_count in actor_line_counts:
                talkativeness = line_count

                self.cursor.execute("""
                    UPDATE actors
                    SET talkativeness = ?
                    WHERE id = ?
                """, (talkativeness, actor_id))

            self.connection.commit()
            logger.info(
                f"Successfully calculated talkativeness for {len(actor_line_counts)} actors")
            return True
        except Exception as e:
            logger.error(f"Error calculating talkativeness: {e}")
            self.connection.rollback()
            return False

    def calculate_conversations_entry_count(self) -> int:

        if self.data is None or self.connection is None or self.cursor is None:
            return False
        try:
            logger.info("Finding conversations without dialogue options...")

            # Get conversations with no dialogue options
            self.cursor.execute("""
                SELECT conversationid, COUNT(*) as 'totalEntries'
                    from dentries
                    group by conversationid
            """)

            convo_entry_counts = self.cursor.fetchall()

            if not convo_entry_counts:
                logger.warning(
                    "No conversations")
                return True

            # Update conversations
            for convo_id, entry_count in convo_entry_counts:

                self.cursor.execute("""
                    UPDATE conversations
                        SET totalEntries = ?, isDeadEnd = ?
                        WHERE id = ?
                """, (entry_count, entry_count <= 2, convo_id))

            self.connection.commit()
            logger.info(
                f"Successfully calculated entry count for {len(convo_entry_counts)} conversations")
            return True
        except Exception as e:
            logger.error(f"Error calculating entry count: {e}")
            self.connection.rollback()
            return False

    def replace_empty_titles(self):
        """
        Replace empty titles with <actor name>: <dialogue text>.
        Long titles trimmed to 36 char and appended with "..." to match others
        """
        if self.data is None or self.connection is None or self.cursor is None:
            return False
        try:
            logger.info("Replacing empty dialogue entry titles...")

            self.cursor.execute("""
                DROP TABLE IF EXISTS temp_dentries;
            """)
            self.connection.commit()
            self.cursor.execute("""
                CREATE TABLE temp_dentries (id INT, conversationid INT, title TEXT);
            """)
            self.connection.commit()
            self.cursor.execute("""
                INSERT INTO temp_dentries (id, conversationid, title)
                SELECT id, conversationid, title
                    FROM 
                    (SELECT dentries.id as 'id', dentries.conversationid as 'conversationid', CONCAT(actors.name, CASE
                        WHEN LENGTH(dentries.dialoguetext) > 39 THEN CONCAT(': "',SUBSTR(dentries.dialoguetext, 1, 39 - 3) || '..."')
                        WHEN dentries.dialoguetext LIKE '' OR dentries.dialoguetext IS NULL THEN ''
                        ELSE CONCAT(': "', dentries.dialoguetext, '"')
                        END) AS 'title'
                    FROM dentries
                    LEFT JOIN conversations ON dentries.conversationid = conversations.id
                    LEFT JOIN actors ON actors.id = dentries.actor
                    WHERE dentries.title LIKE '' OR dentries.title IS NULL);
            """)
            self.connection.commit()
            self.cursor.execute("""
                UPDATE dentries SET displayTitle = (SELECT title FROM temp_dentries WHERE dentries.id = temp_dentries.id AND dentries.conversationid = temp_dentries.conversationid) WHERE dentries.title LIKE '' OR dentries.title IS NULL;
            """)
            self.connection.commit()
            self.cursor.execute("""
                DROP TABLE temp_dentries;
            """)

            self.connection.commit()
            logger.info(
                f"Successfully replaced empty dialgoue entry displayTitles")
            return True
        except Exception as e:
            logger.error(
                f"Error replacing empty dialogue entry displayTitles : {e}")
            self.connection.rollback()
            return False

    def parse(self) -> bool:
        """Run the complete parsing process."""
        try:
            if not self.load_json():
                return False

            if not self.create_database():
                return False

            if not self.parse_actors():
                return False

            if not self.parse_items():
                return False

            if not self.parse_variables():
                return False

            if not self.parse_conversations():
                return False

            if not self.parse_dialogue_entries():
                return False

            # Fill in missing titles
            if not self.replace_empty_titles():
                return False

            # Calculate talkativeness based on dialogue line counts
            if not self.calculate_talkativeness():
                return False

            # Calculate entry count and dead ends for conversations
            if not self.calculate_conversations_entry_count():
                return False

            logger.info("=" * 60)
            logger.info("✓ Parsing complete!")
            logger.info("=" * 60)
            return True

        except Exception as e:
            logger.error(f"Fatal error during parsing: {e}")
            return False
        finally:
            self.close()

    def close(self):
        """Close database connection."""
        if self.connection:
            self.connection.close()
            logger.info("Database connection closed")


def main():
    json_path = "D:\\Disco Elysium\\Source Code\\extractDiscoDb\\Disco Elysium.json"
    schema_sql_path = "D:\\Disco Elysium\\Source Code\\DiscoBrowser\\db\\discobase.sql"
    db_path = "D:\\Disco Elysium\\Source Code\\DiscoBrowser\\db\\discobase.sqlite3"

    # Verify input file exists
    if not Path(json_path).exists():
        logger.error(f"Input file not found: {json_path}")
        sys.exit(1)

    drop_all_tables(db_path)
    parser = DiscoDBParser(json_path, schema_sql_path, db_path)
    success = parser.parse()
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
