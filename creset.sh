git add -A

# Prompt the user to enter a commit message
read -p "Enter your commit message: " commit_message

if [ -z "$commit_message" ]; then
    echo
    echo "No commit message entered, set to default ('minor corrections')"
    echo
    commit_message="minor corrections"
else
    echo
    echo "Commit message set to $commit_message"
    echo
fi

# Commit changes with the provided message
git commit -m "$commit_message"

# Push the changes to the 'main' branch
git push origin main
echo
echo "#############################"
echo "Changes pushed to main branch"
echo "#############################"

# #push to s360_backup
# git push backup
# echo
# echo "########################"
# echo "Changes pushed to backup"
# echo "########################"
