"""
Local CLI entrypoint logic for testing dev environment
Pure Python logic without Modal decorators
Allows testing video generation from command line
"""


def main_cli_logic(prompt: str, generate_educational_video_fn):
    """
    Local entrypoint logic for testing.

    Args:
        prompt: Topic for the video
        generate_educational_video_fn: Modal function reference for video generation

    Usage:
        modal run backend/modal/main_video_generator_dev.py --prompt "Explain photosynthesis"
    """
    print(f"🎬 Starting educational video generation")
    print(f"   Prompt: {prompt}")
    print()

    for update in generate_educational_video_fn.remote_gen(prompt=prompt):
        status = update.get("status")
        message = update.get("message", "")
        progress = update.get("progress_percentage", 0)
        stage_name = update.get("stage_name", "")
        video_url = update.get("video_url")
        error = update.get("error")

        if error:
            print(f"\n❌ Error: {error}")
            if "traceback" in update:
                print(update["traceback"])
            break

        if stage_name:
            print(f"\n[{stage_name}]")

        print(f"  [{progress:3d}%] {message}")

        if video_url:
            print(f"\n✅ Video completed!")
            print(f"   URL: {video_url}")

            metadata = update.get("metadata", {})
            if metadata:
                print(f"\n📊 Metadata:")
                for key, value in metadata.items():
                    print(f"   {key}: {value}")

    print("\n✅ Process completed!")
