#!/usr/bin/env python3
"""
Intelligent test discovery based on code changes.

This script analyzes git changes and uses multiple strategies to find relevant tests:
1. Import analysis - finds tests that import changed modules
2. Semantic search - uses codebase search to find related tests
3. Code references - finds tests that reference changed functions/classes
4. AI analysis (optional) - uses AI to suggest relevant tests
"""

import subprocess
import sys
import re
import os
from pathlib import Path
from typing import Set, List, Dict
import ast
import json


def run_command(cmd: List[str], cwd: str = None) -> str:
    """Run a shell command and return output."""
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=False,
            cwd=cwd
        )
        return result.stdout.strip()
    except Exception as e:
        print(f"Error running command {' '.join(cmd)}: {e}", file=sys.stderr)
        return ""


def get_changed_files(base_branch: str = "main", cwd: str = None) -> List[str]:
    """Get list of changed files compared to base branch."""
    # Try to get diff against base branch
    cmd = ["git", "diff", "--name-only", f"{base_branch}...HEAD"]
    output = run_command(cmd, cwd=cwd)
    
    if not output:
        # Fallback to direct diff
        cmd = ["git", "diff", "--name-only", base_branch]
        output = run_command(cmd, cwd=cwd)
    
    if not output:
        return []
    
    files = [f.strip() for f in output.split('\n') if f.strip()]
    return [f for f in files if f.endswith('.py')]


def get_changed_modules(changed_files: List[str]):
    """Extract module names from changed files.
    
    Returns:
        tuple: (all_modules, specific_modules) where specific_modules excludes generic ones
    """
    modules = set()
    specific_modules = set()  # Track specific (non-generic) modules
    
    # Common modules that are imported by many tests but don't indicate relevance
    # These are too generic - importing them doesn't mean the test is relevant
    generic_modules = {'app', 'app.main', 'app.models', 'app.utils', 'app.database', 'app.schemas'}
    
    for file_path in changed_files:
        # Handle both backend/app/... and app/... paths
        if file_path.startswith('backend/app/'):
            # Remove backend/ prefix for module extraction
            file_path = file_path.replace('backend/', '')
        elif not file_path.startswith('app/'):
            continue
        
        # Convert file path to module path
        # app/routers/auth.py -> app.routers.auth
        # app/services/email_service.py -> app.services.email_service
        module_path = file_path.replace('/', '.').replace('.py', '')
        
        # Always add the specific module
        modules.add(module_path)
        if module_path not in generic_modules:
            specific_modules.add(module_path)
        
        # Only add specific parent modules (not generic ones)
        # app.routers.auth -> add app.routers (but not app)
        # app.services.email_service -> add app.services (but not app)
        parts = module_path.split('.')
        for i in range(1, len(parts)):
            parent_module = '.'.join(parts[:i])
            # Only include parent modules that are specific enough
            # Skip if it's too generic (just 'app' or common modules)
            if parent_module not in generic_modules:
                modules.add(parent_module)
                # Don't add parent modules to specific_modules - only the actual changed module
                # This prevents matching siblings (e.g., if app.services.email_verification_service
                # changed, we don't want to match tests importing app.services.r2_storage_service)
    
    return modules, specific_modules


def find_tests_by_imports(changed_modules: Set[str], test_dir: str = "tests", base_dir: str = None, specific_modules: Set[str] = None) -> Set[str]:
    """Find test files that import changed modules."""
    test_files = set()
    
    # If base_dir is provided, use it; otherwise use current directory
    if base_dir:
        test_dir_path = Path(base_dir) / test_dir
    else:
        test_dir_path = Path(test_dir)
    
    if not test_dir_path.exists():
        return test_files
    
    for test_file in test_dir_path.glob("test_*.py"):
        try:
            with open(test_file, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Parse imports
            tree = ast.parse(content, filename=str(test_file))
            
            # Track what's imported to avoid false positives
            imported_modules = set()
            imported_from_modules = set()
            
            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    for alias in node.names:
                        imported_modules.add(alias.name)
                
                elif isinstance(node, ast.ImportFrom):
                    if node.module:
                        imported_from_modules.add(node.module)
                        # Also check what's being imported
                        for alias in node.names:
                            if alias.name != '*':
                                imported_from_modules.add(f"{node.module}.{alias.name}")
            
            # Check for relevant imports
            # Exclude tests that only import generic modules like app.main (just to get app instance)
            # unless the test file name suggests it's testing that module
            test_filename = Path(test_file).stem  # e.g., 'test_main_middlewares'
            
            # Build a set of all specific changed modules (not parent modules)
            # This helps us avoid matching siblings
            generic_imports = {'app.main', 'app', 'app.models', 'app.utils', 'app.database', 'app.schemas'}
            # Only use specific_modules parameter - don't derive from changed_modules
            # because changed_modules includes parent modules like 'app.services'
            specific_changed_modules = set()
            if specific_modules:
                specific_changed_modules.update(specific_modules)
            
            for changed_module in changed_modules:
                # Skip generic modules unless test is specifically for them
                if changed_module in {'app.main', 'app'}:
                    # Only include if test filename suggests it's testing main.py
                    if 'main' in test_filename.lower():
                        if changed_module in imported_modules or changed_module in imported_from_modules:
                            test_files.add(str(test_file))
                            break
                    # Skip otherwise - app.main is imported by many tests just to get app instance
                    continue
                
                # Skip app.models and app.schemas unless test is specifically for them
                # OR unless the test also imports specific changed modules
                # OR unless the test filename suggests it's testing related functionality
                # These are imported by many tests but don't indicate relevance unless
                # the test is specifically testing models/schemas OR also imports changed modules
                # OR the test filename suggests it's testing auth/email verification
                if changed_module in {'app.models', 'app.schemas'}:
                    # Check if test also imports any specific changed modules
                    imports_specific_changed_module = False
                    if specific_modules:
                        for imported in imported_modules | imported_from_modules:
                            for specific_module in specific_modules:
                                if imported == specific_module or imported.startswith(specific_module + '.'):
                                    imports_specific_changed_module = True
                                    break
                            if imports_specific_changed_module:
                                break
                    
                    # For app.models/app.schemas, use AI to determine relevance if available
                    # Otherwise fall back to checking if test imports specific changed modules
                    module_keyword = changed_module.split('.')[-1]  # 'models' or 'schemas'
                    
                    # Check if test imports specific changed modules
                    if imports_specific_changed_module:
                        if changed_module in imported_modules or changed_module in imported_from_modules:
                            test_files.add(str(test_file))
                            break
                    
                    # If test only imports app.models/app.schemas without specific modules,
                    # use AI to determine relevance (if available and enabled)
                    # For now, skip - AI analysis will handle this in a separate pass
                    # Skip otherwise - app.models/app.schemas are imported by many tests just for setup
                    continue
                
                # For other modules, check imports
                for imported in imported_modules | imported_from_modules:
                    if imported == changed_module:
                        # Exact match - definitely relevant
                        test_files.add(str(test_file))
                        break
                    elif imported.startswith(changed_module + '.'):
                        # Imported is a child of changed_module
                        # But if changed_module is a parent (like app.services), check if imported
                        # is actually a child of a specific changed module, not a sibling
                        if changed_module in specific_changed_modules:
                            # changed_module is specific - OK to match
                            test_files.add(str(test_file))
                            break
                        else:
                            # changed_module is a parent - check if imported is a child of a specific changed module
                            is_child_of_specific = False
                            for specific_module in specific_changed_modules:
                                if imported.startswith(specific_module + '.'):
                                    is_child_of_specific = True
                                    break
                            if is_child_of_specific:
                                test_files.add(str(test_file))
                                break
                            # Otherwise, imported is a sibling, skip
                    elif changed_module.startswith(imported + '.'):
                        # Imported is a parent of changed_module
                        # Only match if it's specific enough (not too generic)
                        if len(imported.split('.')) >= 2:  # At least app.something
                            # Check if they're siblings (same parent, different children)
                            changed_parts = changed_module.split('.')
                            imported_parts = imported.split('.')
                            
                            # If they're the same depth, check if they're siblings
                            if len(changed_parts) == len(imported_parts):
                                # Same depth - check if they share the same parent
                                if changed_parts[:-1] == imported_parts[:-1]:
                                    # Same parent, different children - these are siblings, skip
                                    continue
                            
                            # If imported is shorter, check if changed_module is a child of imported
                            # (this is OK - imported is a parent)
                            # But if imported is longer or same length and different, skip
                            if len(imported_parts) >= len(changed_parts):
                                # Imported is same length or longer - likely a sibling, skip
                                continue
                            
                            test_files.add(str(test_file))
                            break
                if str(test_file) in test_files:
                    break
        except Exception as e:
            # Skip files that can't be parsed
            continue
    
    return test_files


def find_tests_by_references(changed_files: List[str], test_dir: str = "tests", base_dir: str = None) -> Set[str]:
    """Find test files that reference changed code using grep."""
    test_files = set()
    
    # If base_dir is provided, use it; otherwise use current directory
    if base_dir:
        test_dir_path = Path(base_dir) / test_dir
    else:
        test_dir_path = Path(test_dir)
    
    if not test_dir_path.exists():
        return test_files
    
    # Extract function/class names from changed files
    changed_names = set()
    for file_path in changed_files:
        if not file_path.endswith('.py') or not Path(file_path).exists():
            continue
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            tree = ast.parse(content, filename=file_path)
            
            for node in ast.walk(tree):
                if isinstance(node, ast.FunctionDef):
                    changed_names.add(node.name)
                elif isinstance(node, ast.ClassDef):
                    changed_names.add(node.name)
        except Exception:
            continue
    
    # Search for these names in test files
    for test_file in test_dir_path.glob("test_*.py"):
        try:
            with open(test_file, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Check if any changed name appears in the test file
            for name in changed_names:
                # Use word boundaries to avoid partial matches
                pattern = r'\b' + re.escape(name) + r'\b'
                if re.search(pattern, content):
                    test_files.add(str(test_file))
                    break
        except Exception:
            continue
    
    return test_files


def find_tests_by_semantic_search(changed_files: List[str], test_dir: str = "tests", base_dir: str = None) -> Set[str]:
    """Use codebase search to find semantically related tests."""
    test_files = set()
    
    # Determine base directory for file lookups
    if base_dir:
        base_path = Path(base_dir)
    else:
        base_path = Path.cwd()
    
    # For each changed file, try to understand what it does
    for file_path in changed_files:
        # Adjust file path if base_dir is provided
        if base_dir and not file_path.startswith(str(base_path)):
            full_path = base_path / file_path
        else:
            full_path = Path(file_path)
        
        if not file_path.endswith('.py') or not full_path.exists():
            continue
        
        # Extract key concepts from the file
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Find class and function names
            tree = ast.parse(content, filename=file_path)
            concepts = []
            
            for node in ast.walk(tree):
                if isinstance(node, ast.ClassDef):
                    concepts.append(node.name)
                elif isinstance(node, ast.FunctionDef):
                    concepts.append(node.name)
            
            # Search for these concepts in test files
            test_dir_path = Path(test_dir)
            for test_file in test_dir_path.glob("test_*.py"):
                try:
                    with open(test_file, 'r', encoding='utf-8') as f:
                        test_content = f.read()
                    
                    # Check if test file mentions any of the concepts
                    for concept in concepts:
                        if concept.lower() in test_content.lower():
                            test_files.add(str(test_file))
                            break
                except Exception:
                    continue
        except Exception:
            continue
    
    return test_files


def analyze_test_relevance_with_ai(test_file: Path, changed_modules: Set[str], specific_modules: Set[str], base_dir: str = None) -> bool:
    """
    Use Cursor CLI to analyze if a test file is relevant to changed modules.
    
    Args:
        test_file: Path to the test file
        changed_modules: Set of changed module names
        specific_modules: Set of specific (non-generic) changed modules
        base_dir: Base directory for context
    
    Returns:
        True if test is relevant, False otherwise
    """
    try:
        # Read test file content
        with open(test_file, 'r', encoding='utf-8') as f:
            test_content = f.read()
        
        # Extract imports and key identifiers (classes, functions) using AST
        imports = []
        test_classes = []
        test_functions = []
        
        try:
            tree = ast.parse(test_content, filename=str(test_file))
            
            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    for alias in node.names:
                        imports.append(f"import {alias.name}")
                elif isinstance(node, ast.ImportFrom):
                    if node.module:
                        names = [alias.name for alias in node.names if alias.name != '*']
                        if names:
                            imports.append(f"from {node.module} import {', '.join(names[:5])}")  # Limit to 5 imports per line
                        else:
                            imports.append(f"from {node.module} import *")
                elif isinstance(node, ast.ClassDef):
                    if node.name.startswith('Test'):
                        test_classes.append(node.name)
                elif isinstance(node, ast.FunctionDef):
                    if node.name.startswith('test_'):
                        test_functions.append(node.name)
        except Exception:
            # Fallback: extract imports using regex if AST parsing fails
            import_lines = re.findall(r'^(?:from\s+\S+\s+)?import\s+.*$', test_content, re.MULTILINE)
            imports = import_lines[:20]  # Limit to 20 import lines
        
        # Build concise summary
        imports_str = '\n'.join(imports[:15])  # Limit to 15 import lines
        test_classes_str = ', '.join(test_classes[:5]) if test_classes else 'None'
        test_functions_str = ', '.join(test_functions[:10]) if test_functions else 'None'
        
        # Build prompt for Cursor CLI
        changed_modules_str = ', '.join(sorted(specific_modules)[:10])  # Limit to first 10
        prompt = f"""Analyze if this test file is relevant to changed Python modules:

Changed modules: {changed_modules_str}

Test file: {test_file.name}
Imports:
{imports_str}

Test classes: {test_classes_str}
Test functions: {test_functions_str}

Question: Is this test file relevant to testing the functionality in the changed modules? Consider:
1. Do the imports reference the changed modules?
2. Do the test functions/classes test endpoints, functions, or classes from the changed modules?
3. Does it test related functionality that might be affected by the changes?

Respond with only "YES" or "NO" followed by a brief one-sentence explanation."""
        
        # Try to use cursor-agent CLI
        # Use -p for prompt mode (non-interactive, prints response)
        cmd = ["cursor-agent", "-p", prompt]
        
        # Debug output: show exact command and prompt
        print(f"\n[DEBUG] Analyzing {test_file.name} with cursor-agent", file=sys.stderr)
        print(f"[DEBUG] Command: {' '.join(cmd[:2])} [PROMPT_BODY]", file=sys.stderr)
        print(f"[DEBUG] Prompt body ({len(prompt)} chars):", file=sys.stderr)
        print("=" * 80, file=sys.stderr)
        print(prompt, file=sys.stderr)
        print("=" * 80, file=sys.stderr)
        print(f"[DEBUG] Working directory: {base_dir if base_dir else 'current'}", file=sys.stderr)
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=100,  # 10 second timeout per test file
            cwd=base_dir if base_dir else None
        )
        
        # Debug output: show result
        print(f"[DEBUG] Return code: {result.returncode}", file=sys.stderr)
        if result.stdout:
            print(f"[DEBUG] stdout ({len(result.stdout)} chars):", file=sys.stderr)
            print(result.stdout[:500], file=sys.stderr)
            if len(result.stdout) > 500:
                print(f"... (truncated, {len(result.stdout) - 500} more chars)", file=sys.stderr)
        if result.stderr:
            print(f"[DEBUG] stderr ({len(result.stderr)} chars):", file=sys.stderr)
            print(result.stderr[:500], file=sys.stderr)
            if len(result.stderr) > 500:
                print(f"... (truncated, {len(result.stderr) - 500} more chars)", file=sys.stderr)
        
        if result.returncode == 0:
            output = result.stdout.strip().upper()
            # Check if output contains "YES" (case-insensitive)
            # cursor-agent may return "**YES**" or "YES" with markdown formatting
            print(f"[DEBUG] Parsed output (uppercase): {output[:200]}...", file=sys.stderr)
            # Look for YES in various formats: "YES", "**YES**", "YES —", etc.
            if "YES" in output and "**NO**" not in output:
                print(f"[DEBUG] ✓ Test {test_file.name} is RELEVANT", file=sys.stderr)
                return True
            else:
                print(f"[DEBUG] ✗ Test {test_file.name} is NOT relevant", file=sys.stderr)
        else:
            # Check if cursor-agent is not available or misconfigured
            stderr_lower = result.stderr.lower() if result.stderr else ""
            stdout_lower = result.stdout.lower() if result.stdout else ""
            if "not found" in stderr_lower or "not found" in stdout_lower or "error" in stderr_lower:
                print(f"[DEBUG] ✗ cursor-agent error for {test_file.name}", file=sys.stderr)
                # Don't print warning for every test file, just return False
                return False
            print(f"[DEBUG] ✗ Test {test_file.name} - non-zero return code", file=sys.stderr)
            return False
            
    except subprocess.TimeoutExpired as e:
        print(f"[DEBUG] Timeout expired for {test_file.name} after 30 seconds", file=sys.stderr)
        # Try to get any partial output if available
        if hasattr(e, 'stdout') and e.stdout:
            print(f"[DEBUG] Partial stdout: {e.stdout[:500]}", file=sys.stderr)
        if hasattr(e, 'stderr') and e.stderr:
            print(f"[DEBUG] Partial stderr: {e.stderr[:500]}", file=sys.stderr)
        print(f"Warning: AI analysis timeout for {test_file.name} (cursor-agent took >30s)", file=sys.stderr)
        return False
    except FileNotFoundError:
        # cursor-agent not installed
        return False
    except Exception as e:
        # Silently fail and return False
        return False
    
    return False


def analyze_test_batch_with_ai(test_files_batch: List[Path], changed_modules: Set[str], specific_modules: Set[str], base_dir: str = None) -> Set[str]:
    """
    Analyze a batch of test files with cursor-agent in a single call.
    
    Args:
        test_files_batch: List of test file paths to analyze
        changed_modules: Set of changed module names
        specific_modules: Set of specific (non-generic) changed modules
        base_dir: Base directory for context
    
    Returns:
        Set of relevant test file paths
    """
    relevant_tests = set()
    
    if not test_files_batch:
        return relevant_tests
    
    try:
        # Extract imports and key info from all test files in batch
        test_summaries = []
        for test_file in test_files_batch:
            try:
                with open(test_file, 'r', encoding='utf-8') as f:
                    test_content = f.read()
                
                # Extract imports and key identifiers using AST
                imports = []
                test_classes = []
                test_functions = []
                
                try:
                    tree = ast.parse(test_content, filename=str(test_file))
                    
                    for node in ast.walk(tree):
                        if isinstance(node, ast.Import):
                            for alias in node.names:
                                imports.append(f"import {alias.name}")
                        elif isinstance(node, ast.ImportFrom):
                            if node.module:
                                names = [alias.name for alias in node.names if alias.name != '*']
                                if names:
                                    imports.append(f"from {node.module} import {', '.join(names[:5])}")
                                else:
                                    imports.append(f"from {node.module} import *")
                        elif isinstance(node, ast.ClassDef):
                            if node.name.startswith('Test'):
                                test_classes.append(node.name)
                        elif isinstance(node, ast.FunctionDef):
                            if node.name.startswith('test_'):
                                test_functions.append(node.name)
                except Exception:
                    # Fallback: extract imports using regex
                    import_lines = re.findall(r'^(?:from\s+\S+\s+)?import\s+.*$', test_content, re.MULTILINE)
                    imports = import_lines[:20]
                
                imports_str = '\n'.join(imports[:10])  # Limit imports per file
                test_classes_str = ', '.join(test_classes[:3]) if test_classes else 'None'
                test_functions_str = ', '.join(test_functions[:5]) if test_functions else 'None'
                
                test_summaries.append({
                    'name': test_file.name,
                    'imports': imports_str,
                    'classes': test_classes_str,
                    'functions': test_functions_str
                })
            except Exception:
                continue
        
        if not test_summaries:
            return relevant_tests
        
        # Build batch prompt
        changed_modules_str = ', '.join(sorted(specific_modules)[:10])
        
        # Format test summaries
        test_list = []
        for i, summary in enumerate(test_summaries, 1):
            test_list.append(f"""
Test {i}: {summary['name']}
Imports:
{summary['imports']}
Test classes: {summary['classes']}
Test functions: {summary['functions']}
""")
        
        prompt = f"""Analyze which of these test files are relevant to changed Python modules:

Changed modules: {changed_modules_str}

Test files to analyze:
{''.join(test_list)}

For each test file, determine if it's relevant to testing the functionality in the changed modules. Consider:
1. Do the imports reference the changed modules?
2. Do the test functions/classes test endpoints, functions, or classes from the changed modules?
3. Does it test related functionality that might be affected by the changes?

Respond with a list of test file names that are RELEVANT, one per line, prefixed with "RELEVANT: ". 
If none are relevant, respond with "RELEVANT: none"."""
        
        # Debug output
        print(f"\n[DEBUG] Analyzing batch of {len(test_files_batch)} test files with cursor-agent", file=sys.stderr)
        print(f"[DEBUG] Command: cursor-agent -p [PROMPT_BODY]", file=sys.stderr)
        print(f"[DEBUG] Prompt body ({len(prompt)} chars, {len(test_files_batch)} files)", file=sys.stderr)
        print("=" * 80, file=sys.stderr)
        print(prompt[:1000], file=sys.stderr)
        if len(prompt) > 1000:
            print(f"... (truncated, {len(prompt) - 1000} more chars)", file=sys.stderr)
        print("=" * 80, file=sys.stderr)
        
        # Call cursor-agent
        cmd = ["cursor-agent", "-p", prompt]
        import time
        start_time = time.time()
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=60,  # 60 seconds for batch analysis
            cwd=base_dir if base_dir else None
        )
        elapsed_time = time.time() - start_time
        print(f"[DEBUG] cursor-agent completed in {elapsed_time:.2f} seconds", file=sys.stderr)
        print(f"[DEBUG] Return code: {result.returncode}", file=sys.stderr)
        
        if result.stdout:
            print(f"[DEBUG] stdout ({len(result.stdout)} chars):", file=sys.stderr)
            print(result.stdout[:1000], file=sys.stderr)
            if len(result.stdout) > 1000:
                print(f"... (truncated, {len(result.stdout) - 1000} more chars)", file=sys.stderr)
        
        if result.stderr:
            print(f"[DEBUG] stderr ({len(result.stderr)} chars):", file=sys.stderr)
            print(result.stderr[:500], file=sys.stderr)
        
        if result.returncode == 0:
            # Parse response - look for "RELEVANT: <filename>" lines
            # cursor-agent may return markdown format: "**RELEVANT: test_file.py**" or "RELEVANT: test_file.py"
            output = result.stdout
            output_upper = output.upper()
            
            # Extract all test file names mentioned after "RELEVANT:"
            for test_file in test_files_batch:
                # Check various formats:
                # - "**RELEVANT: test_file.py**"
                # - "RELEVANT: test_file.py"
                # - "**RELEVANT:** test_file.py"
                patterns = [
                    f"**RELEVANT:** {test_file.name}",
                    f"**RELEVANT: {test_file.name}**",
                    f"RELEVANT: {test_file.name}",
                    f"RELEVANT: {test_file.name.replace('_', ' ')}",  # Handle spaces
                ]
                
                for pattern in patterns:
                    if pattern.upper() in output_upper:
                        relevant_tests.add(str(test_file))
                        print(f"[DEBUG] ✓ {test_file.name} is RELEVANT", file=sys.stderr)
                        break
        
    except subprocess.TimeoutExpired:
        print(f"[DEBUG] Batch analysis timeout after 60 seconds", file=sys.stderr)
    except Exception as e:
        print(f"[DEBUG] Batch analysis error: {e}", file=sys.stderr)
    
    return relevant_tests


def analyze_changes_with_ai(changed_files: List[str], test_dir: str = "tests", base_dir: str = None) -> Set[str]:
    """
    Use AI to analyze changes and suggest relevant tests.
    
    This uses Cursor CLI to semantically analyze test files in batches
    and determine if they're relevant to the changed code.
    """
    test_files = set()
    
    # Get changed modules
    changed_modules, specific_modules = get_changed_modules(changed_files)
    
    # If no specific modules, skip AI analysis
    if not specific_modules:
        return test_files
    
    # Determine test directory path
    if base_dir:
        test_dir_path = Path(base_dir) / test_dir
    else:
        test_dir_path = Path(test_dir)
    
    if not test_dir_path.exists():
        return test_files
    
    # Only analyze test files that import app.models or app.schemas
    # (these are the ones that need AI analysis to determine relevance)
    generic_modules = {'app.models', 'app.schemas'}
    tests_to_analyze = []
    
    for test_file in test_dir_path.glob("test_*.py"):
        try:
            with open(test_file, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Parse imports
            tree = ast.parse(content, filename=str(test_file))
            imported_modules = set()
            
            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    for alias in node.names:
                        imported_modules.add(alias.name)
                elif isinstance(node, ast.ImportFrom):
                    if node.module:
                        imported_modules.add(node.module)
            
            # Check if test imports generic modules
            if any(module in imported_modules for module in generic_modules):
                # Check if it doesn't already import specific changed modules
                imports_specific = False
                for imported in imported_modules:
                    for specific_module in specific_modules:
                        if imported == specific_module or imported.startswith(specific_module + '.'):
                            imports_specific = True
                            break
                    if imports_specific:
                        break
                
                # Only analyze if it doesn't import specific modules
                if not imports_specific:
                    tests_to_analyze.append(test_file)
        except Exception:
            continue
    
    # Analyze tests in batches to speed up
    batch_size = 10  # Analyze 10 test files at a time
    print(f"Analyzing {len(tests_to_analyze)} test files with AI in batches of {batch_size}...", file=sys.stderr)
    
    for i in range(0, len(tests_to_analyze), batch_size):
        batch = tests_to_analyze[i:i + batch_size]
        print(f"[DEBUG] Processing batch {i//batch_size + 1} ({len(batch)} files)...", file=sys.stderr)
        batch_results = analyze_test_batch_with_ai(batch, changed_modules, specific_modules, base_dir)
        test_files.update(batch_results)
    
    return test_files


def get_file_changes_summary(file_path: str, base_branch: str = "main") -> str:
    """Get a summary of what changed in a file."""
    cmd = ["git", "diff", f"{base_branch}...HEAD", "--", file_path]
    diff = run_command(cmd)
    
    if not diff:
        cmd = ["git", "diff", base_branch, "--", file_path]
        diff = run_command(cmd)
    
    if not diff:
        return ""
    
    # Extract function/class names from diff
    changed_items = []
    for line in diff.split('\n'):
        if line.startswith('+') and ('def ' in line or 'class ' in line):
            # Extract function or class name
            match = re.search(r'(?:def|class)\s+(\w+)', line)
            if match:
                changed_items.append(match.group(1))
    
    return ', '.join(set(changed_items))


def main():
    """Main function to find relevant tests."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Find relevant tests for changed code"
    )
    parser.add_argument(
        '--base',
        default='main',
        help='Base branch to compare against (default: main)'
    )
    parser.add_argument(
        '--test-dir',
        default='tests',
        help='Test directory (default: tests)'
    )
    parser.add_argument(
        '--output',
        choices=['files', 'json', 'list'],
        default='list',
        help='Output format (default: list)'
    )
    parser.add_argument(
        '--no-ai',
        action='store_true',
        help='Disable AI analysis (AI is enabled by default if cursor-agent is available)'
    )
    
    args = parser.parse_args()
    
    # Find git repository root (works from any subdirectory)
    git_root = None
    original_cwd = os.getcwd()
    current_dir = Path(original_cwd)
    
    for parent in [current_dir] + list(current_dir.parents):
        if (parent / '.git').exists():
            git_root = parent
            break
    
    if not git_root:
        print("Error: Not in a git repository", file=sys.stderr)
        sys.exit(1)
    
    # Change to git root directory for git commands
    os.chdir(git_root)
    
    # Get changed files (from git root)
    changed_files = get_changed_files(args.base, cwd=str(git_root))
    
    if not changed_files:
        print("No Python files changed", file=sys.stderr)
        os.chdir(original_cwd)
        sys.exit(0)
    
    # Filter to only backend files and adjust paths
    # Git returns paths relative to repo root (e.g., backend/app/routers/auth.py)
    # We need to strip 'backend/' prefix for module analysis when running from backend dir
    backend_changed_files = []
    for f in changed_files:
        # Only process backend files
        if f.startswith('backend/'):
            backend_changed_files.append(f)
    
    # If we're in backend directory, use backend files
    if 'backend' in str(original_cwd):
        changed_files = backend_changed_files if backend_changed_files else changed_files
    
    print(f"Changed files: {len(changed_files)}", file=sys.stderr)
    for f in changed_files:
        print(f"  - {f}", file=sys.stderr)
    
    # Adjust paths for analysis
    # When running from backend/, strip 'backend/' prefix from file paths for module analysis
    # Test directory is already correct (tests/)
    test_dir = args.test_dir
    if 'backend' in str(original_cwd):
        # Remove 'backend/' prefix from file paths for module extraction
        # backend/app/routers/auth.py -> app/routers/auth.py
        changed_files_for_modules = []
        for f in changed_files:
            if f.startswith('backend/'):
                changed_files_for_modules.append(f.replace('backend/', '', 1))
            else:
                changed_files_for_modules.append(f)
    else:
        changed_files_for_modules = changed_files
    
    # Find relevant tests using multiple strategies
    test_files = set()
    
    # Determine base directory for test discovery
    # If running from backend/, use original_cwd as base; otherwise use git_root
    if 'backend' in str(original_cwd):
        base_dir_for_tests = str(original_cwd)  # backend directory
    else:
        base_dir_for_tests = str(git_root)
    
    # Strategy 1: Import analysis
    changed_modules, specific_modules = get_changed_modules(changed_files_for_modules)
    import_tests = find_tests_by_imports(changed_modules, test_dir, base_dir=base_dir_for_tests, specific_modules=specific_modules)
    test_files.update(import_tests)
    print(f"\nTests found by import analysis: {len(import_tests)}", file=sys.stderr)
    
    # Strategy 2: Code references
    reference_tests = find_tests_by_references(changed_files_for_modules, test_dir, base_dir=base_dir_for_tests)
    test_files.update(reference_tests)
    print(f"Tests found by code references: {len(reference_tests)}", file=sys.stderr)
    
    # Strategy 3: Semantic search
    semantic_tests = find_tests_by_semantic_search(changed_files_for_modules, test_dir, base_dir=base_dir_for_tests)
    test_files.update(semantic_tests)
    print(f"Tests found by semantic search: {len(semantic_tests)}", file=sys.stderr)
    
    # Strategy 4: AI analysis (enabled by default if cursor-agent is available)
    # Use AI to analyze tests that import generic modules (app.models, app.schemas)
    # to determine if they're actually relevant
    if not hasattr(args, 'no_ai') or not args.no_ai:
        try:
            ai_tests = analyze_changes_with_ai(changed_files_for_modules, test_dir, base_dir=base_dir_for_tests)
            test_files.update(ai_tests)
            print(f"Tests found by AI analysis: {len(ai_tests)}", file=sys.stderr)
        except Exception as e:
            print(f"Warning: AI analysis failed: {e}", file=sys.stderr)
            print("Continuing without AI analysis...", file=sys.stderr)
    
    # Remove duplicates and sort
    test_files = sorted(set(test_files))
    
    # Adjust test file paths to be relative to backend/tests
    adjusted_test_files = []
    for test_file in test_files:
        # Convert absolute paths to relative paths
        test_file_path = Path(test_file)
        
        # If it's an absolute path, make it relative to backend directory
        if test_file_path.is_absolute():
            if 'backend' in str(original_cwd):
                # Running from backend/, make relative to backend
                try:
                    rel_path = test_file_path.relative_to(Path(original_cwd))
                    adjusted_test_files.append(str(rel_path))
                except ValueError:
                    # If can't make relative, try to extract just the filename part
                    if 'tests/' in str(test_file_path):
                        # Extract tests/test_*.py part
                        parts = str(test_file_path).split('tests/')
                        if len(parts) > 1:
                            adjusted_test_files.append(f"tests/{parts[-1]}")
                        else:
                            adjusted_test_files.append(test_file)
                    else:
                        adjusted_test_files.append(test_file)
            else:
                # Running from git root, keep as is or adjust
                if 'backend/tests/' in str(test_file_path):
                    parts = str(test_file_path).split('backend/tests/')
                    if len(parts) > 1:
                        adjusted_test_files.append(f"backend/tests/{parts[-1]}")
                    else:
                        adjusted_test_files.append(test_file)
                else:
                    adjusted_test_files.append(test_file)
        elif test_file.startswith('tests/'):
            # Already relative, use as is
            adjusted_test_files.append(test_file)
        elif test_file.startswith('backend/tests/'):
            # Remove backend/ prefix if we're running from backend
            adjusted_test_files.append(test_file.replace('backend/', ''))
        else:
            # Ensure it starts with tests/
            adjusted_test_files.append(f"tests/{test_file}" if not test_file.startswith('tests/') else test_file)
    
    # Restore original working directory
    os.chdir(original_cwd)
    
    # Output results
    if args.output == 'json':
        result = {
            'changed_files': changed_files,
            'test_files': list(adjusted_test_files),
            'count': len(adjusted_test_files)
        }
        print(json.dumps(result, indent=2))
    elif args.output == 'files':
        for test_file in adjusted_test_files:
            print(test_file)
    else:  # list format
        if adjusted_test_files:
            print(' '.join(adjusted_test_files))
        else:
            print("tests/")  # Fallback to all tests
    
    return 0 if adjusted_test_files else 1


if __name__ == '__main__':
    sys.exit(main())

