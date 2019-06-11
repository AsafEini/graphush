const {GraphQLServer} = require('graphql-yoga/dist/index');
const {prisma} = require('./generated/prisma-client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const APP_SECRET = 'GraphQL-is-aw3some';

function getUserId(context) {
    const Authorization = context.request.get('Authorization');
    if (Authorization) {
        const token = Authorization.replace('Bearer ', '');
        const { userId } = jwt.verify(token, APP_SECRET);
        return userId
    }

    throw new Error('Not authenticated')
}

const resolvers = {
    Query: {
        info: () => 'Hey there!!',
        feed: (parent, args, context) => context.prisma.links(),
    },
    User: {
        links: (parent, args, context) => {
            return context.prisma.user({ id: parent.id }).links()
        }
    },
    Link: {
        postedBy: (parent, args, context) => {
            return context.prisma.link({id: parent.id}).postedBy();
        }
    },
    Mutation: {
        post: (parent, args, context) => {
            const userId = getUserId(context);
            return context.prisma.createLink({
                url: args.url,
                description: args.description,
                postedBy: {connect: {id: userId}}
            })
        },
        updateLink: (parent, args, context) => {
            return context.prisma.updateLink({
                data: {
                    url: args.url,
                    description: args.description,
                },
                where: {id: args.id}
            })
        },
        deleteLink: (parent, args, context) => {
            return context.prisma.deleteLink({id: args.id})
        },
        signup: async (parent, args, context, info) => {
            const password = await bcrypt.hash(args.password, 10);
            const user = await context.prisma.createUser({...args, password});
            const token = jwt.sign({userId: user.id}, APP_SECRET);
            return {
                token,
                user
            }
        },
        login: async (parent, args, context, info) => {
            const user = await context.prisma.user({email: args.email});
            if(!user) {
                throw new Error('no such user');
            }

            const valid = await bcrypt.compare(args.password, user.password);
            if(!valid) {
                throw new Error ('bad move slick!');
            }

            const token = jwt.sign({userId: user.id}, APP_SECRET);
            return {
                token,
                user
            }
        }
    }
};

const server = new GraphQLServer({
    typeDefs: './src/schema.graphql',
    resolvers,
    context: request => {
        return {
            ...request,
            prisma
        }
    }
});

server.start(() => {
    console.log('Running on localhost:4000')
});