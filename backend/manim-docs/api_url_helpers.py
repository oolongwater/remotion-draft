"""
Manim API Reference URL Helper Functions

This module provides utilities to construct URLs for Manim API documentation
based on the hierarchical structure defined in api-reference-tree.json
"""

import json
from pathlib import Path
from typing import List, Dict, Optional, Any

# Load the API tree structure
_current_directory = Path(__file__).parent
_tree_path = _current_directory / "api-reference-tree.json"

with open(_tree_path, 'r') as file:
    _api_tree = json.load(file)


def build_url(path: str, item_name: str) -> str:
    """
    Constructs a full documentation URL for a given class/item

    Args:
        path: The dot-notation path (e.g., "animation.creation")
        item_name: The class/item name (e.g., "Create")

    Returns:
        The full URL to the documentation page

    Example:
        >>> build_url("animation.animation", "Add")
        'https://docs.manim.community/en/stable/reference/manim.animation.animation.Add.html'
    """
    base_url = _api_tree["baseUrl"]
    return f"{base_url}.{path}.{item_name}.html"


def build_module_url(path: str) -> str:
    """
    Constructs a module documentation URL (without a specific class)

    Args:
        path: The dot-notation path (e.g., "animation.creation")

    Returns:
        The full URL to the module documentation page

    Example:
        >>> build_module_url("animation.creation")
        'https://docs.manim.community/en/stable/reference/manim.animation.creation.html'
    """
    base_url = _api_tree["baseUrl"]
    return f"{base_url}.{path}.html"


def find_item_url(item_name: str) -> Optional[str]:
    """
    Finds and returns the URL for a specific class/item by name
    Searches across all categories and modules

    Args:
        item_name: The name of the class/item to find

    Returns:
        The full URL if found, None otherwise

    Example:
        >>> find_item_url("Create")
        'https://docs.manim.community/en/stable/reference/manim.animation.creation.Create.html'
    """
    for category in _api_tree["categories"]:
        for module in category["modules"]:
            # Check in main module items
            if "items" in module and item_name in module["items"]:
                return build_url(module["path"], item_name)

            # Check in submodules
            if "submodules" in module:
                url = _search_submodules(module["submodules"], item_name)
                if url:
                    return url

    return None


def _search_submodules(submodules: List[Dict[str, Any]], item_name: str) -> Optional[str]:
    """Helper function to recursively search submodules for an item"""
    for submodule in submodules:
        if "items" in submodule and item_name in submodule["items"]:
            return build_url(submodule["path"], item_name)

        if "submodules" in submodule:
            url = _search_submodules(submodule["submodules"], item_name)
            if url:
                return url

    return None


def get_module_items(path: str) -> List[str]:
    """
    Gets all items (classes) within a specific module path

    Args:
        path: The dot-notation path (e.g., "animation.creation")

    Returns:
        List of item names in that module, or empty list if not found

    Example:
        >>> get_module_items("animation.creation")
        ['AddTextLetterByLetter', 'Create', 'Write', ...]
    """
    for category in _api_tree["categories"]:
        for module in category["modules"]:
            if module["path"] == path:
                return module.get("items", [])

            if "submodules" in module:
                items = _search_submodules_for_path(module["submodules"], path)
                if items:
                    return items

    return []


def _search_submodules_for_path(submodules: List[Dict[str, Any]], path: str) -> List[str]:
    """Helper function to recursively search submodules for a path"""
    for submodule in submodules:
        if submodule["path"] == path:
            return submodule.get("items", [])

        if "submodules" in submodule:
            items = _search_submodules_for_path(submodule["submodules"], path)
            if items:
                return items

    return []


def get_category_items(category_name: str) -> List[Dict[str, str]]:
    """
    Gets all items in a category with their full URLs

    Args:
        category_name: The category name (e.g., "Animations", "Mobjects")

    Returns:
        List of dictionaries with item name, URL, and path

    Example:
        >>> get_category_items("Animations")
        [
            {'name': 'Add', 'url': 'https://...', 'path': 'animation.animation'},
            {'name': 'Create', 'url': 'https://...', 'path': 'animation.creation'},
            ...
        ]
    """
    category = next(
        (cat for cat in _api_tree["categories"] if cat["category"] == category_name),
        None
    )

    if not category:
        return []

    results = []

    for module in category["modules"]:
        if "items" in module:
            for item in module["items"]:
                results.append({
                    "name": item,
                    "url": build_url(module["path"], item),
                    "path": module["path"]
                })

        if "submodules" in module:
            _collect_items_from_submodules(module["submodules"], results)

    return results


def _collect_items_from_submodules(submodules: List[Dict[str, Any]], results: List[Dict[str, str]]) -> None:
    """Helper function to recursively collect items from submodules"""
    for submodule in submodules:
        if "items" in submodule:
            for item in submodule["items"]:
                results.append({
                    "name": item,
                    "url": build_url(submodule["path"], item),
                    "path": submodule["path"]
                })

        if "submodules" in submodule:
            _collect_items_from_submodules(submodule["submodules"], results)


def search_items(query: str) -> List[Dict[str, str]]:
    """
    Searches for items matching a query string (case-insensitive)

    Args:
        query: The search query

    Returns:
        List of matching items with their details

    Example:
        >>> search_items("circle")
        [
            {'name': 'Circle', 'category': 'Mobjects', 'url': 'https://...', 'path': 'mobject.geometry.arc'},
            {'name': 'ArrowCircleTip', 'category': 'Mobjects', 'url': 'https://...', 'path': 'mobject.geometry.tips'},
            ...
        ]
    """
    results = []
    lower_query = query.lower()

    for category in _api_tree["categories"]:
        for module in category["modules"]:
            if "items" in module:
                for item in module["items"]:
                    if lower_query in item.lower():
                        results.append({
                            "name": item,
                            "category": category["category"],
                            "url": build_url(module["path"], item),
                            "path": module["path"]
                        })

            if "submodules" in module:
                _search_items_in_submodules(
                    module["submodules"],
                    lower_query,
                    category["category"],
                    results
                )

    return results


def _search_items_in_submodules(
    submodules: List[Dict[str, Any]],
    query: str,
    category_name: str,
    results: List[Dict[str, str]]
) -> None:
    """Helper function to recursively search items in submodules"""
    for submodule in submodules:
        if "items" in submodule:
            for item in submodule["items"]:
                if query in item.lower():
                    results.append({
                        "name": item,
                        "category": category_name,
                        "url": build_url(submodule["path"], item),
                        "path": submodule["path"]
                    })

        if "submodules" in submodule:
            _search_items_in_submodules(submodule["submodules"], query, category_name, results)


def get_api_tree() -> Dict[str, Any]:
    """
    Gets the complete tree structure

    Returns:
        The complete API tree dictionary
    """
    return _api_tree


def get_categories() -> List[str]:
    """
    Gets all category names

    Returns:
        List of category names

    Example:
        >>> get_categories()
        ['Animations', 'Cameras', 'Configuration', 'Mobjects', 'Scenes', 'Utilities']
    """
    return [cat["category"] for cat in _api_tree["categories"]]


def get_base_url() -> str:
    """
    Gets the base URL for the Manim documentation

    Returns:
        The base URL string
    """
    return _api_tree["baseUrl"]


def get_all_items_flat() -> List[Dict[str, str]]:
    """
    Gets all items from all categories in a flat list

    Returns:
        List of all items with their details

    Example:
        >>> items = get_all_items_flat()
        >>> len(items)
        500+
    """
    all_items = []

    for category in _api_tree["categories"]:
        category_items = get_category_items(category["category"])
        for item in category_items:
            item["category"] = category["category"]
            all_items.append(item)

    return all_items


# Example usage and testing
if __name__ == "__main__":
    # Test the helper functions
    print("Testing Manim API URL Helpers\n")

    # Test 1: Build URL
    print("1. Building URL for 'Add' in animation.animation:")
    url = build_url("animation.animation", "Add")
    print(f"   {url}\n")

    # Test 2: Find item URL
    print("2. Finding URL for 'Circle':")
    url = find_item_url("Circle")
    print(f"   {url}\n")

    # Test 3: Get module items
    print("3. Getting items in 'animation.creation' module:")
    items = get_module_items("animation.creation")
    print(f"   Found {len(items)} items: {items[:5]}...\n")

    # Test 4: Search items
    print("4. Searching for 'arrow':")
    results = search_items("arrow")
    print(f"   Found {len(results)} matches:")
    for result in results[:5]:
        print(f"   - {result['name']} ({result['category']})")
    print()

    # Test 5: Get categories
    print("5. All categories:")
    categories = get_categories()
    print(f"   {categories}\n")

    # Test 6: Get category items
    print("6. Getting all items in 'Cameras' category:")
    camera_items = get_category_items("Cameras")
    print(f"   Found {len(camera_items)} items:")
    for item in camera_items:
        print(f"   - {item['name']}")
